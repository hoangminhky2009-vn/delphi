# 05 — LỆNH BÁN KHỐNG TRONG SHOP + DỌN UI VỀ SHOP (founder 01/08)

**Lệnh founder (nguyên văn, 4 ý):** *"Bộ đếm thời gian vẫn đôi khi bị lỗi. /
Thay đổi cơ chế chiến thuật bán khống, bây giờ cho phép người chơi mở thêm lệnh
bán khống trong shop cho các loại tài sản ngoài 2 lệnh hiện tại là bán và mua. /
T đã bảo bỏ cái phần phân bổ vốn ở ngoài bàn cược rồi cơ mà? Đa số thao tác phải
được thao tác trong shop, kể cả là cam kết danh mục. / T muốn người chơi ở sảnh
khi lật thẻ sẽ thấy được số lãi lỗ trong khung hình chứ không phải lướt xuống."*

## ĐÃ THI HÀNH 01/08 (cùng ngày)

1. **Đồng hồ — vá lưới thứ 3**: watchdog 12s + resync-khi-409 không đỡ được app
   CHẠY NỀN trên điện thoại (HĐH treo timer JS). Nay nghe `visibilitychange` →
   quay lại foreground là hỏi lại server ngay. Đúng khớp "đôi khi" của founder.
2. **Kết quả vòng LÊN ĐẦU khung nhìn**: lần dời trước vẫn để nó SAU map + quản
   trị vốn — mobile vẫn phải lướt. Nay khối lãi/lỗ + ChainReveal đứng TRƯỚC map.
3. **Quản trị vốn ẨN trên trận nav** (đảo đã chết `nav_dung_lenh`; panel đứng
   ngoài bàn là "phân bổ vốn ngoài shop" mà founder đã cấm). ⚠ NỢ: nút KHOÁ tài
   sản chuyển vào shop khi làm thẻ Đầu Tư Dài Hạn (spec 02).
4. **CHỐT VÒNG ngay trong shop** (trận nav): mua → xếp mốc → chốt, không rời
   shop — "đa số thao tác trong shop, kể cả cam kết danh mục".

## THIẾT KẾ BÁN KHỐNG = CHIỀU LỆNH THỨ BA (CHƯA CODE — phiên sau, cổng v17)

- **Đặc quyền lá Bán Khống đổi hình** (thay short-khớp-trễ-1-vòng của D37 §2.5):
  ghế cầm lá thấy thêm hàng **KHỐNG** trong panel mốc của shop — mở vị thế khống
  theo mốc trên tiền mặt (ký quỹ), đóng bằng mốc trên vị thế khống. Không cầm lá
  = không có hàng (che tầng API như bộ đo Lướt Sóng).
- **Engine**: `vi_the_khong: Record<ma, chip_ky_quy>`; định giá ĐẢO DẤU trên
  phần khống (mã rơi → khống lãi); NAV = tiền mặt + vị thế dài + giá trị khống
  (kẹp ≥ 0 — "lãi có trần, lỗ không đáy" giới hạn bởi ký quỹ đã đặt, đúng phân
  vai D37: khống là VỊ THẾ ĐỘC LẬP, Phòng Hộ là BẢO HIỂM); trượt giá 2 đầu vào
  Quỹ vòng; nền NAV (v14) tính cả khống; sức căng vế xấu KHÔNG khuếch đại phần
  khống theo chiều có lợi (khống ăn khi mã sập — phải cân để không thành vé
  một chiều: gate Kelly + bot đu-khống đo trước khi flip).
- **⭐ Số chờ đo**: trần khống %NAV · phí giữ khống mỗi vòng (funding) · trượt.
- Log: `hd_cam_ket.lenh` thêm chiều `'khong' | 'dong_khong'`; events giữ khuôn.

## THI CÔNG XONG 01/08 — `balance-v17-khong` = MẶC ĐỊNH

Sổ khống `vi_the_khong` (mở = ký quỹ từ tiền mặt theo mốc, định giá ĐẢO phần
theo-mã, kẹp ≥ 0 — cháy ký quỹ là hết lệnh); trần 30% NAV (⭐); phí giữ 150bp/
vòng (⭐, v1 ĐỐT như lạm phát — lệch doc có chủ đích, ghi tại call site); nền
v14 pro-rata trừ CẢ hai sổ; MỞ cần lá ban_khong + cổng v17, ĐÓNG luôn được;
sổ khống không vào gương tai_san, không lộ sang đối thủ. UI: hàng KHỐNG/ĐÓNG
KHỐNG trong panel mốc. Kelly v17: GATE ĐẠT (2,835 ≈ v15 2,839 — khống chưa
làm méo thế giới của người không dùng). Nợ đo: bot đu-khống trước G-gates.

**⚠ ĐÍNH CHÍNH LỚN (phát hiện khi đo v17):** cổng `duoi5` (v16) TỪNG KHÔNG
được luồn từ taoTran vào sinhMap — trang trí #15 — VÀ bot Kelly trong script
tính μ/σ trên cả 12 mặt (5 mặt không thể nổ) ⇒ **mọi số đo v16 trước đây đo
trên thế giới v15 với bot bị pha loãng; kết luận "đuôi nghiền ghế tập trung"
SAI NGUỒN, v16 chưa từng bị đo thật.** Cả hai đã vá; v16 đo lại từ đầu ở
phiên G-gates.

## CÒN MỞ

GIA_BAN_SAO_THEM (D42, ⭐200–300 Q) vẫn chờ founder · G1–G4 re-run (D43 bước 7,
v16 sau cổng) · gate 7.7/7.8 · playtest founder (task #27).
