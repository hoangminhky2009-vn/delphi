# SPEC — Báo lỗi của người chơi: ô Báo lỗi trong Hồ sơ · lỗi client ẩn danh lên Sentry · đoạn điều khoản

cỡ: THƯỜNG · miền: ha_tang (chạm du_lieu · giao_dien · pháp lý)
hiệu lực: tới khi ship · trạng thái: THI CÔNG XONG (12/10, nhánh `claude/thi-cong-bao-loi`, D600) — chờ founder bấm · CHỐT bản 1 (11/10 — founder duyệt nguyên văn mục 7; sửa cùng ngày: chữ Báo lỗi vào DB, chuông Sentry không chữ — mục 6) · trạm 1: không dựng demo riêng — bảng chép khuôn
panel sẵn có của Hồ sơ (`CongTacDuLieu`), chữ đã chốt ở mục 7; THI CÔNG soi trên local rồi đưa ảnh ở trạm 4

⚠ **Cửa một chiều** (consent · A10 — CLAUDE.md A11.17): app sẽ làm khác lời hứa hiện tại ở
`web/src/content/dieuKhoan.ts`. Không `--bo-qua`. Thứ tự thi công bắt buộc: **chữ điều khoản + thẻ báo trước
lên cùng bản và đi TRƯỚC đường gửi** (mục 5 có bài canh ép thứ tự này trên từng máy).

## 1. Người chơi làm được gì sau việc này
"Em gặp lỗi thì vào Hồ sơ bấm BÁO LỖI, gõ vài dòng, gửi — không cần mở app mail — và nếu điền email thì
được trả lời." Còn khi app vỡ mà người chơi không nói gì, founder vẫn biết lỗi gì · màn nào · bản nào, kể cả với
người đã tắt nghiên cứu và khách.

## 2. Người dùng nói / làm gì
- Founder 11/10 chọn ô trong app, **bác mailto**: mailto phụ thuộc app mail trên máy và không mang ngữ cảnh gỡ lỗi.
- Hiện tại người chưa bật `research_consent` và khách gặp lỗi thì **không để lại dấu nào**: `loi_client` là
  telemetry, và telemetry không ghi khi chưa đồng ý (`server/telemetry.ts` cổng đồng ý ở chỗ ghi). `ManLoi.tsx:90`
  tự ghi *"Chưa có Sentry ở client"*.
- Điều khoản tự xin: *"Nếu bạn thấy chỗ nào trang này hứa mà app làm khác, báo ngay"* (`dieuKhoan.ts` mục beta),
  nhưng app chưa có kênh báo nào ngoài email cuối trang.
- giả thuyết: số người thật mùa này nhỏ (A11.1), nên số báo cáo tính bằng đơn vị/tuần. Việc này là **ống đo**:
  tuần ship xong thì cược là ĐO (đếm feedback + issue client trên Sentry), không xây thêm (L1).

## 3. Ngoài phạm vi — cố ý KHÔNG làm
- Không nhúng `@sentry/browser` hay bất kỳ SDK nào vào web. Lỗi client đi **qua server của mình** rồi mới sang
  Sentry (lý do ở mục 6). Không thêm nhà cung cấp, 0đ (C1).
- Không gửi thông điệp lỗi, stack hay URL thô từ client: chỉ mã `maLoi()` (băm sẵn) + mã màn `manCuaDuong()`
  (mẫu route, không id) + `BAN_PHAT_HANH`.
- Không có nút "Báo lỗi này" trên màn lỗi (`ThanManLoi`) — để Ý chờ.
- Không có hộp thư trả lời trong app: founder trả lời bằng email ngoài app (chỉ khi người gửi có điền email).
- Không đổi `events`/`telemetry`: `loi_client` vẫn ghi y như cũ cho người đã đồng ý (A9 giữ nguyên).
- Không sửa chữ của bốn cửa consent sổ chi tiêu hay buổi đo (có phiên bản riêng; việc này không chạm chúng).

## 4. Ba thứ founder sẽ THẤY (để bấm 5 phút ở trạm 4)
1. **Hồ sơ → ✉ BÁO LỖI** (nút thứ năm trong hàng nút, mở bảng giống DỮ LIỆU CỦA TÔI): ô gõ (≤ 1.000 ký tự) ·
   ô email tuỳ chọn · dòng "Gửi kèm: bản 0.0.6x · màn <màn trước Hồ sơ> · mã lỗi <…|không có> · mã tài khoản" ·
   nút GỬI. Gửi xong: "Đã gửi. Có điền email thì tụi mình trả lời trong vòng một tuần." Lượt thứ tư trong ngày:
   chữ báo đã hết lượt, ô vẫn giữ nội dung.
2. **Hộp thư founder** nhận email chuông Sentry "có báo lỗi mới" (nhãn `ban` · `man` · `ma_loi`, **không** chữ người
   gõ, không mã tài khoản, không email); đọc chữ + mã tài khoản + email ở **trang admin** (bảng báo lỗi trong DB).
3. **Máy chưa xem thẻ thì chưa gửi**: mở app bản mới lần đầu thấy thẻ "Điều khoản vừa đổi" (mục 7). Bấm "Đã hiểu"
   rồi ép một lỗi client ⇒ Sentry có issue `loi_client` với mã lỗi + màn + bản, **không** có user id, email hay IP
   người chơi. Làm lại trên máy CHƯA bấm thẻ ⇒ Sentry không có gì.

## 5. Tiêu chí máy kiểm được
- test server (`tests/bao_loi_nguoi_choi.test.ts`, Postgres nhúng + SDK giả tiêm vào adapter):
  - feedback: cần đăng nhập · 3 lượt/ngày/tài khoản (lượt 4 ⇒ 429, không ghi, không gọi SDK) · > 1.000 ký tự ⇒ 400 ·
    email sai hình ⇒ bỏ trường, không 4xx · ghi **bảng riêng trong DB** (KHÔNG phải `events` — A9), xoá cùng tài khoản
    (`/account/delete`); migration + bài cùng commit (A11.4) · chuông SDK chỉ nhận `ban`/`man`/`ma_loi` — quét payload
    SDK giả: **không** chữ người gõ, mã tài khoản, email (C7) · admin đọc được danh sách (requireAdmin).
  - lỗi client ẩn danh: chạy được với khách, người đồng ý và người không đồng ý · gói tới SDK **không có** user id,
    IP, email, cookie (quét mọi khoá của payload SDK giả) · `ma`/`man` sai hình dạng (khác `MAU_MA`, không phải mẫu
    route) ⇒ bỏ im lặng · trần toàn cục/ngày (mặc định 50 — `config/bao_loi.ts`) và trần theo IP; vượt trần ⇒ 202
    không gọi SDK (không để client thử lại mãi) · không DSN ⇒ 202, kênh IM.
  - `loi_client` telemetry giữ nguyên hành vi (bài cũ phải xanh không sửa).
- test web (`web/tests/`):
  - **bài canh thứ tự** (cửa một chiều): `baoLoiAnDanh()` không gọi mạng khi cờ "đã xem thẻ điều khoản <ngày>" chưa
    có; có cờ thì gọi đúng một lần cho mỗi mã mỗi phiên.
  - **bài canh chữ ↔ hành vi**: danh sách trường client gửi lên (một hằng `TRUONG_BAO_LOI_AN_DANH`) khớp đúng các
    thứ đoạn điều khoản liệt kê; thêm một trường mà không sửa điều khoản ⇒ đỏ.
  - bảng Báo lỗi: dòng "Gửi kèm" lấy từ cùng hằng với payload (không gõ tay hai lần — A11.5).
  - bài quét A10 + bài quét chữ ở `web/tests` vẫn xanh với chữ mới.
- tiêm ngược (`npm run tiem`): (a) thêm `user_id` vào payload ẩn danh ⇒ bài quét payload đỏ; (b) bỏ cổng "đã xem
  thẻ" ⇒ bài canh thứ tự đỏ; (c) bỏ trần lượt feedback ⇒ bài lượt 4 đỏ; (d) cho chữ người gõ vào chuông SDK ⇒ bài
  quét payload đỏ; (e) bỏ xoá theo tài khoản ⇒ bài xoá đỏ.
- kịch bản luồng: `tests/luong/trinh-duyet/` — chưa có, viết cùng việc: Hồ sơ → BÁO LỖI → gửi → thấy câu đã gửi.
- prod (cửa sổ VẬN HÀNH, sau deploy): một feedback thật ⇒ chuông email về founder + dòng ở trang admin; `/health` (có header bí mật) vẫn
  `bao_loi.noi_ra_ngoai: true`.

## 6. Quyết định · Ý chờ
| ngày | founder chọn gì |
|---|---|
| 11/10 | Ô Báo lỗi **trong app** (Hồ sơ) → server → Sentry User Feedback → email founder; bác mailto. |
| 11/10 | Lỗi client của người chưa bật `research_consent` ⇒ gửi Sentry **ẩn danh** (mã lỗi + màn + phiên bản). |
| 11/10 | A — ẩn danh áp cho **mọi người, một đường** (khách · chưa bật · đã bật); telemetry `loi_client` cho người đã bật giữ nguyên. |
| 11/10 | A — ô Báo lỗi gửi kèm **mã tài khoản nội bộ** (uuid, không email/tên); dòng "Gửi kèm" hiện ngay dưới ô. |
| 11/10 | A — báo trước **cùng bản**: thẻ một lần khi mở app; máy chưa thấy thẻ thì **chưa gửi** lỗi ẩn danh. |
| 11/10 | A — báo lỗi ẩn danh **không có công tắc tắt** (không chỉ về ai; giống nhật ký lỗi máy chủ). |
| 11/10 | A — **duyệt nguyên văn** chữ T1–T10 ở mục 7. Đổi một chữ ⇒ hỏi lại founder (cửa một chiều). |
| 11/10 (sau CHỐT, cửa sổ mẹ VẬN HÀNH) | Thống nhất với SPEC `chan-truoc-beta` (D592, nhánh `claude/chan-truoc-beta`), vốn cũng có Báo lỗi: chữ người gõ **lưu bảng riêng trong DB** (đọc ở admin, xoá cùng tài khoản); Sentry chỉ nhận **chuông không chữ**; trần **3**/ngày/người (thay số 5 của D592). Phần Báo lỗi: SPEC này là nguồn. Founder duyệt câu thay trong T5. |
| 11/10 (cửa sổ THI CÔNG) | A — **chia ranh** với THI CÔNG `chan-truoc-beta` (đã dựng ~70% ô Báo lỗi trước khi có phiếu): họ commit nguyên phần đã dựng, không sửa tiếp; cửa sổ này làm lỗi ẩn danh + thẻ T9 + chữ T1–T8, rồi gộp nhánh họ để chỉnh trần 3 · T10 · chuông không chữ. |
| 11/10 (cửa sổ THI CÔNG) | A — `CAP_NHAT_LUC` tạm `11/10/2026`; **cửa sổ VẬN HÀNH đặt lại ngày lên prod lúc phát hành** (đổi ngày = đổi khoá cờ "đã xem thẻ"; trước khi ship chưa ai thấy thẻ nên vô hại). |
| 12/10 (cửa sổ THI CÔNG, lúc gộp D604) | A — câu Báo lỗi ở mục "Bạn làm gì được" (mảng `QUYEN`, D604): bỏ nút "Báo lỗi này", kể đúng danh sách T5 — *"**Báo lỗi** ngay trong app — **Hồ sơ → Báo lỗi**. Tụi mình nhận chữ bạn gõ kèm số bản app, màn bạn vừa đứng trước khi vào Hồ sơ, mã lỗi gần nhất, mã tài khoản, và email nếu bạn tự điền."* · A — T6 ghép chỉ đường của D604: "trong **Hồ sơ → Dữ liệu của tôi**". |

Agent tự quyết (kỹ thuật/UI — ghi lý do một dòng, A8.7):
- **Qua server, không SDK trình duyệt** (áp cho báo lỗi ẩn danh + chuông): Sentry không thấy IP người chơi · DSN không lộ ra web · một chỗ giữ trần
  5.000 sự kiện/tháng (`docs/deploy_gd0.md` Bước 7) · bundle không tăng · adapter `SdkBaoLoi` (`server/bao_loi.ts`)
  thêm `captureMessage` (chữ người gõ không đi Sentry nên không cần `captureFeedback`) — đổi nhà cung cấp vẫn chỉ đổi điểm vào.
- "Màn" của ô Báo lỗi = **màn ngay trước Hồ sơ** (lúc bấm thì ai cũng đang ở Hồ sơ); lấy từ bộ theo dõi màn sẵn có
  của `web/src/lib/telemetry.ts`, chỉ giữ trong bộ nhớ, không gửi gì thêm.
- "Mã lỗi gần nhất" = mã `maLoi()` cuối cùng trong phiên (bộ nhớ), không đọc lại từ server.
- 3 lượt/ngày/tài khoản, ≤ 1.000 ký tự, email tuỳ chọn; trần lỗi ẩn danh 50/ngày toàn app — số hạ tầng, không phải
  tham số kinh tế; nằm ở `config/bao_loi.ts`, đo lại sau 2 tuần.
- Một máy gửi mỗi mã lỗi tối đa một lần mỗi phiên (cú sập lặp trong vòng render không đốt hạn mức).
- Kiểm lúc thi công, chưa chắc: (a) Sentry có tự gửi email cho feedback không (Settings → Notifications); không thì
  đặt một alert rule — vẫn 0đ; (b) feedback có tính vào trần 5.000 không; (c) vùng lưu dữ liệu của tổ chức Sentry
  (chữ điều khoản viết "nước ngoài" để không phụ thuộc kết quả).

**Ý chờ** (ghi, KHÔNG làm trong việc này; L2):
- Nút "Báo lỗi này" ngay trên màn lỗi `ThanManLoi` (điền sẵn mã lỗi). Khó ở lỗi gốc ngoài router: không có Hồ sơ để
  chuyển tới, phải dựng ô ngay trong màn lỗi.
- Khách gửi feedback (hiện cần đăng nhập vì trần theo tài khoản).
- Hộp thư trả lời trong app.

## 7. Chữ điều khoản mới — NGUYÊN VĂN, founder duyệt 11/10

Thi công chép **đúng từng chữ** (giọng tếu theo luật giọng đầu `dieuKhoan.ts`). Dòng số là số dòng của
`web/src/content/dieuKhoan.ts` tại `ba164f17`. `CAP_NHAT_LUC` = ngày bản này lên prod.
Giữ nguyên, có lý do: dòng 49 + 140 ("không bán, không chia cho ai") — Sentry là dịch vụ cất hộ để tụi mình đọc,
không phải bên được chia; T7 nói rõ điều đó. Dòng 141 ("màn nào hay lỗi" trong dấu vết thao tác) vẫn đúng cho
telemetry của người đã bật, nên giữ.

**T1 — Tóm tắt, chèn sau dòng 47:**
> Khi app **vỡ** trên máy bạn, máy gửi về **một mã lỗi không gắn với bạn**: mã lỗi, tên màn, số bản. Cái này không tắt, vì nó chỉ nói app hỏng ở đâu, không nói gì về bạn.

**T2 — dòng 82 (khách), thay câu cuối:**
> Lúc đó tụi mình cũng không ghi gì về bạn cho nghiên cứu cả — chỉ có báo lỗi ẩn danh ở mục Dữ liệu, thứ không biết bạn là ai.

**T3 — dòng 143, thay cả đoạn:**
> **Có ba loại ghi, và chỉ một loại tắt được.** Nước đi trong trận thì phải ghi, vì nó **chính là số dư của bạn** — không ghi thì không chơi tiếp được. Dấu vết thao tác (bạn dừng ở màn nào, bỏ hướng dẫn ở đâu) là phần nghiên cứu, và phần đó **tắt được**. Loại thứ ba là báo lỗi ẩn danh, ngay dưới đây.

**T4 — đoạn mới, chèn sau dòng 144:**
> **Báo lỗi ẩn danh — loại thứ ba.** Khi app vỡ trên máy bạn, máy gửi về đúng ba thứ: **một mã lỗi** (kiểu `route:typeerror:1f3kq2` — một chuỗi băm, không chở lời nhắn lỗi), **tên màn** đang mở, và **số bản app**. Không mã tài khoản, không email, không chữ bạn gõ. Nó đi qua máy chủ của tụi mình rồi mới tới **Sentry** — một dịch vụ cất báo cáo lỗi, máy chủ đặt ở nước ngoài — nên Sentry cũng không thấy địa chỉ mạng của bạn. Áp cho mọi người, kể cả khách và cả khi bạn đã tắt phần nghiên cứu: nó không biết bạn là ai, nên cũng chẳng có gì về bạn để tắt. Lỗi phía máy chủ của tụi mình cũng báo về cùng chỗ đó.

**T5 — đoạn mới, chèn sau T4:**
> **Ô Báo lỗi trong Hồ sơ thì khác: đó là bạn tự gửi.** Nó mang đi **đúng chữ bạn gõ**, kèm **số bản app**, **màn bạn vừa đứng trước khi vào Hồ sơ**, **mã lỗi gần nhất** trên máy (nếu có), **mã tài khoản** (một chuỗi ngẫu nhiên để tụi mình tìm đúng trận của bạn mà dựng lại lỗi — không phải email, không phải tên) và **email nếu bạn tự điền** để được trả lời. Cái này cất trong cơ sở dữ liệu của app ở Singapore — cùng chỗ với tài khoản, xoá tài khoản là xoá luôn. Sentry chỉ nhận một tiếng chuông 'có báo lỗi mới' kèm số bản, tên màn và mã lỗi — không có chữ bạn gõ, không mã tài khoản, không email. Ngay dưới ô luôn có một dòng ghi chính xác cái gì đi kèm. Đừng dán mật khẩu hay số tài khoản ngân hàng vào đó — tụi mình không cần, và cũng không muốn giữ.

**T6 — dòng 146, thay cả đoạn** (12/10 founder A: ghép chỉ đường "Hồ sơ → Dữ liệu của tôi" của D604):
> **Tắt lúc nào cũng được**, trong **Hồ sơ → Dữ liệu của tôi**, và tụi mình ngừng ghi dấu vết thao tác **ngay lập tức** (báo lỗi ẩn danh ở trên vẫn chạy — nó không gắn với bạn). Bật lại là leo hạng tiếp — token, thứ hạng, đồ trang trí vẫn nguyên.

**T7 — dòng 147, thay cả đoạn:**
> **Dữ liệu nằm ở đâu:** cơ sở dữ liệu đặt ở **Singapore**, app chạy nhờ hai dịch vụ hạ tầng có máy chủ nhiều nơi trên thế giới, nên đường truyền có thể đi qua nước khác; báo lỗi thì cất ở **Sentry** (ở trên), máy chủ ở nước ngoài. Tụi mình không tự dựng máy chủ, và cũng không gửi dữ liệu của bạn cho bên nào khác ngoài chính mấy dịch vụ chạy app này.

**T8 — dòng 164, thay cả đoạn:**
> **Hỏi bất cứ điều gì** qua email ở cuối trang, hoặc ô **Báo lỗi** trong Hồ sơ. Tụi mình có đúng một người trả lời, nên hơi chậm — nhưng sẽ trả lời, và cố trong vòng một tuần.

**T9 — thẻ báo trước (hiện một lần mỗi máy, khi mở app bản mới):**
> **ĐIỀU KHOẢN VỪA ĐỔI · <ngày>**
> Hai thứ mới. Khi app vỡ, máy bạn gửi về một mã lỗi không gắn với bạn (mã lỗi · tên màn · số bản). Và Hồ sơ có ô Báo lỗi — bạn gõ gì, cái đó tới tay người làm app.
> [Xem chỗ đổi] → `/dieu-khoan#du-lieu` · [Đã hiểu]   — bấm nút nào cũng tính là đã xem.

**T10 — bảng ✉ BÁO LỖI trong Hồ sơ:**
> nhãn ô: **Gặp lỗi gì, kể tụi mình nghe** · gợi ý trong ô: *Bấm gì · thấy gì · đáng lẽ phải thấy gì*
> nhãn email: **Email (không bắt buộc) — điền thì tụi mình trả lời**
> dòng kèm: **Gửi kèm:** bản <x> · màn <y> · mã lỗi <z | không có> · mã tài khoản
> dòng cuối: Đừng dán mật khẩu hay số tài khoản vào đây.
> gửi xong: **Đã gửi.** Có điền email thì tụi mình trả lời trong vòng một tuần.
> hết lượt: Hôm nay bạn gửi đủ 3 lượt rồi. Mai gửi tiếp, hoặc viết email ở cuối trang Điều khoản.
