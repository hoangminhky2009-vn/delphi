# Specification by part — map

The app split into eight parts, each with its own specification: what it does now, what it must do, and enough detail to hand the part to someone else without touching the others. These files describe the system; when they disagree with the code or with the rules in `docs/luat/`, the code and the rules win and the file is corrected in the same commit.

*The document below is in Vietnamese, the language of the project.*

## Tám phần

| # | file | phần | một câu |
|---|---|---|---|
| 1 | `01-gameplay.md` | Gameplay / game loop | Engine Đấu trường NAV — nơi 1.560/1.582 event của app đang sống (D86) |
| 2 | `02-ui-ux.md` | UI-UX client | React + PWA + Discord Activity; pixel §XI; client KHÔNG BAO GIỜ tính tiền (C4) |
| 3 | `03-thu-data.md` | Thu data hành vi | `events` append-only vs `telemetry` 90 ngày (A9) — data là SẢN PHẨM (A1) |
| 4 | `04-ha-tang-bao-mat.md` | Hạ tầng + bảo mật | Worker → Vercel 1 function → Supabase; scheduler 2 lớp; auth/2FA/CSP |
| 5 | `05-kinh-te-token.md` | Kinh tế token | T/Q/Kho bạc/burn; A4-A5 là kinh thánh; tường lửa T↔Q vĩnh viễn |
| 6 | `06-cho-du-bao-va-admin.md` | Chợ dự báo + admin | Sản phẩm gốc, mùa 0.0 HẠ BẬC (không khoá); panel quản trị |
| 7 | `07-tai-chinh-ca-nhan.md` | Tài chính cá nhân & insight | Thẻ tính cách B2C + hướng business mùa sau (founder 15/08) |
| 8 | `08-may-tinh-toan.md` | Máy tính toán Đấu trường | Xác suất · tương quan · mọi công thức tiền của engine (founder 09/09) |

⚠ **Phần 8 KHÔNG theo khuôn A/B/C/D dưới đây, và cố ý thế.** Bảy phần đầu chia
theo QUYỀN SỞ HỮU FILE — mỗi phần là một gói giao được cho một cửa sổ. Phần 8 chia
theo CHỦ ĐỀ và cắt NGANG qua phần 1: nó không sở hữu file nào, chỉ tập trung một
chỗ mọi phép tính xác suất/tương quan/tiền đang nằm rải trong `config/holdem.ts` +
`server/holdem/*`. Sở hữu vẫn thuộc phần 1 — mâu thuẫn thì phần 1 và CODE thắng.
Founder 09/09 đặt hàng nó để trả lời một câu hỏi phần 1 không trả lời gọn được:
*tương quan giữa thẻ sự kiện ↔ tài sản ↔ tài sản và lõi ↔ lõi thật sự tính thế nào.*

## Vì sao KHÔNG tái cấu trúc thư mục (quyết định 15/08)

Code GIỮ NGUYÊN CHỖ; "chia" nghĩa là mỗi phần có DANH SÁCH FILE nó sở hữu
(mục D của từng file). Ba lý do:
1. Đang có cửa sổ khác nối dây kỳ ngộ trên chính `server/` + `config/` — di
   chuyển file bây giờ là xung đột chắc chắn.
2. Di chuyển file là viết lại mọi import + kiểm lại replay/test toàn bộ, đổi
   lấy đúng cái lợi mà một bản đồ sở hữu trong docs đã cho được.
3. Khi có team thật nhiều người thì tái cấu trúc là MỘT PHIÊN RIÊNG, có bản
   đồ này làm nền — không làm nhân tiện.

## Khuôn chung của mỗi file

```
A. VAI TRÒ & HIỆN TRẠNG   — phần này là gì, đang chạy tới đâu trên prod
B. KIẾN TRÚC & DÒNG CHẢY  — cơ chế chính, dữ liệu đi đường nào
C. LUẬT BẤT BIẾN          — MỘT DÒNG mỗi luật + con trỏ về CLAUDE.md (không chép toàn văn — bản chép sẽ trôi, D61/D80)
D. RANH GIỚI FILE         — sở hữu / dùng chung (phải phối hợp) / cấm đụng
E. NGHIỆM THU             — lệnh chạy + tiêu chí để tuyên "xong"
F. NỢ ĐANG TREO           — việc đã biết là chưa xong, kèm nguồn D-số
```

## Luật XUYÊN SUỐT — áp cho MỌI phần

**Một nguồn duy nhất: `CLAUDE.md` §A11** (bảng 10 luật từng nằm ở đây đã hợp nhất
về đó 24/08, D132 — bản chép thứ hai sẽ trôi, D61). Đáng nhớ nhất khi cầm bất kỳ
phần nào: tham số kinh tế founder chốt (A8.2) · `events` append-only, phân vân ⇒
telemetry (A3.3/A9) · cổng `balance_version` · migration cùng commit · một nguồn
không bản sao · `git add` đích danh.

## File dùng CHUNG nhiều phần — phối hợp bắt buộc

| file | thuộc chính | phần khác đụng vào khi | luật phối hợp |
|---|---|---|---|
| `config/holdem.ts` | 1-Gameplay | 3-Data đọc hằng số log; 2-UI đọc nhãn qua catalog | chỉ phần 1 SỬA; phần khác chỉ ĐỌC |
| `server/holdem_api.ts` | 1-Gameplay | 3-Data (event trong tx), 4-Hạ tầng (rate limit) | sửa phải chạy test cả hai phía |
| `server/app.ts` | 4-Hạ tầng | mọi phần đăng ký route | middleware/headers là của phần 4 |
| `migrations/` | 4-Hạ tầng giữ khuôn | phần nào cần schema thì tự viết migration | cùng commit với code (luật 4) |
| `web/src/lib/xemTruocLenh.ts` + alias `@server` | 2-UI | phép tính bên trong là của phần 1 | UI không bao giờ chép công thức (C4/D67) |
| `web/src/lib/vocab.ts`, `labels.ts`, `tinh_cach.ts` | 2-UI | 1/7 đẻ khái niệm mới cần nhãn | nhãn ở tự điển client (D26), server trả ID+SỐ |
| `server/sandbox/{gacha,ung_vien,rng}.ts`, `config/sandbox*.ts` | 5-Kinh tế | 1-Gameplay đọc rng + preset | ⚠ TÊN là sandbox nhưng là shop/engine THẬT — xoá mù là giết holdem (D81) |
| `server/holdem/{pot,cuoc}.ts` | 1-Gameplay | — | di tích D40 nhưng CÒN import từ engine/bots/holdem_api — ĐO trước khi động dao (bài học D81), không tự dọn |

## Nghiệm thu toàn cục (chạy được từ gốc repo)

```
npm test              # test gốc (108 file)
npm run web:test      # test web (48 file)
npm run typecheck     # tsc server; web có tsc riêng trong web/
npm run lint:css-anim && npm run lint:pixel-art && npm run lint:pool-lock   # lint:lexicon đã bị D91 gỡ
npm run gate          # G1-G4 Monte Carlo (phần 1 bắt buộc khi đổi engine)
npm run audit:supply  # sổ cái CÂN (phần 5)
```
