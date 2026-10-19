<!--
  ⚠⚠ TỆP NÀY LÀ **LUẬT**, NGANG HÀNG `CLAUDE.md` — KHÔNG PHẢI BẢN ĐỒ.
  Khác `docs/dac-ta/` (bản đồ, trôi được, thua CLAUDE.md khi mâu thuẫn): nội
  dung ở đây được DỜI RA từ chính CLAUDE.md ngày 01/09 để hiến pháp gọn lại,
  nên nó vẫn giữ nguyên thứ hạng. Mâu thuẫn giữa code và tệp này ⇒ **tệp này
  thắng**, y như trước khi dời.
  Muốn làm khác ⇒ DỪNG, hỏi founder, chờ duyệt (A8.1).
-->

# LUẬT — KINH TẾ TOKEN: THAM SỐ & CÔNG THỨC

> Tham số kinh tế và công thức parimutuel, kèm test vector chép tay. Agent KHÔNG tự đổi số ở đây (A8.2).
>
> **Đọc khi:** động vào bet · payout · rake · cap · Brier · bất kỳ phép tính tiền nào
>
> Cửa vào: [`CLAUDE.md`](../../CLAUDE.md) — luật làm việc + bản đồ.
> Bản đồ luật: [`00-muc-luc.md`](00-muc-luc.md).

---

## A4. Tham số kinh tế (nguồn chân lý duy nhất)

Code phải đặt toàn bộ tham số này trong MỘT file hằng số duy nhất
(`config/economy.ts` hoặc tương đương), không rải rác magic number.

| Hằng số | Giá trị | Ghi chú |
|---|---|---|
| `STARTING_BANKROLL` | 1.000 T | Vốn khởi điểm mỗi user |
| `RAKE_BURN` | 3% | Đốt vĩnh viễn, tính trên tổng pool |
| `RAKE_TREASURY` | 2% | Vào Kho bạc, tính trên tổng pool |
| `BET_CAP_PCT` | 20% | Trần tổng cược 1 user trên 1 kèo (định nghĩa chuẩn ở A5.3) |
| `MIN_BET` | 1 T | |
| `SUBSIDY_THRESHOLD` | 500 T | Dưới ngưỡng → được nhận trợ cấp ngày |
| `SUBSIDY_AMOUNT` | 50 T/ngày | Gắn hành động check-in nhận, chi từ Kho bạc |
| `SUBSIDY_MONTHLY_CAP` | 1.000 T/tháng/user | |
| `UNRANKED_THRESHOLD` | 5 kèo đã resolve/pool | Dưới ngưỡng → Unranked trong pool đó |
| `RESOLUTION_TIMEOUT` | 7 ngày | Quá hạn nguồn không công bố → hủy, hoàn 100% |
| `AGE_GATE_MIN` | 16 | Config, có thể nâng 18 |
| `SEASON_LENGTH` | 3 tháng | v0.1 chưa chạy reset mùa, chỉ lưu `season_id` trên dữ liệu |

## A5. Công thức chuẩn (kèm test vector — code PHẢI pass đúng số)

### A5.1. Parimutuel payout (thủ tục số nguyên, tất định)

Khi kèo resolve với cửa thắng `w`:

```
P     = tổng token trong pool (mọi bet, gồm cả seed)
burn  = floor(P × 0.03)
trea  = floor(P × 0.02)
D     = P − burn − trea            # phần chia lại
S_w   = tổng token đặt ở cửa thắng (gồm seed ở cửa đó)

Với từng bet b_i ở cửa thắng:
payout_i = floor(b_i × D / S_w)    # nhân trước, chia sau, floor một lần

residual = D − Σ payout_i          # phần dư do floor → ĐỐT (cộng vào burn)
Payout của seed ở cửa thắng → chuyển về Kho bạc (không phải user nào nhận).
```

Bất biến kiểm tra sau mỗi lần resolve (viết thành assertion trong code):
`P == Σ payout_user + payout_seed_về_kho_bạc + burn + residual + trea`

**Ngoại lệ 1 — 100% token NGƯỜI CHƠI nằm ở cửa thắng:** hoàn nguyên từng
bet 100%, không rake, seed về Kho bạc nguyên vẹn.
**Ngoại lệ 2 — kèo hủy** (admin hủy / quá 7 ngày không nguồn): hoàn 100%
mọi bet của người chơi, seed về Kho bạc nguyên vẹn, không rake.
**Ghi chú:** vì seed luôn phủ mọi cửa nên S_w > 0 luôn đúng với kèo có seed.
Kèo không seed mà S_w = 0 (không ai đặt cửa thắng) → toàn bộ D vào Kho bạc.

### A5.2. Test vectors (số đã tính tay — dùng làm unit test bắt buộc)

**Vector 1 — không seed, 3 cửa.** Bets: A đặt 200 @ cửa X; B đặt 300 @ cửa Y;
C đặt 500 @ cửa Y. P = 1.000. Cửa Y thắng.
- burn = 30, trea = 20, D = 950, S_w = 800
- payout B = floor(300×950/800) = 356; payout C = floor(500×950/800) = 593
- residual = 950 − 949 = 1 → đốt. Kiểm: 1.000 = 949 + (30+1) + 20 ✓

**Vector 2 — có seed, 4 cửa, seed 100/cửa (400 từ Kho bạc).**
Người chơi: A 300 @ cửa 1; B 100 @ cửa 2; C 200 @ cửa 3. P = 1.000. Cửa 1 thắng.
- burn = 30, trea = 20, D = 950, S_w = 300 + 100(seed) = 400
- payout A = floor(300×950/400) = 712; payout seed = floor(100×950/400) = 237 → Kho bạc
- residual = 950 − 949 = 1 → đốt. Kiểm: 1.000 = 712 + 237 + 31 + 20 ✓

**Vector 3 — 100% một cửa:** mọi bet người chơi đều ở cửa thắng → từng người
nhận lại đúng số đã đặt, seed về Kho bạc, burn = trea = 0.

**Vector 4 — hủy kèo:** như Vector 3 nhưng áp cho mọi cửa.

### A5.3. Cap 20%/kèo (định nghĩa tất định)

Tại thời điểm mỗi lệnh đặt/điều chỉnh vào kèo K:

```
tai_san_quy_chieu = bankroll_kha_dung + tổng_token_user_đang_đặt_ở_kèo_K
cap_K             = floor(0.20 × tai_san_quy_chieu)
Điều kiện hợp lệ:  (tổng_đang_đặt_ở_K + lượng_mới) ≤ cap_K
```

Ví dụ: bankroll 1.000, chưa đặt gì → cap 200. Đặt 200 (còn 800). Đặt thêm 50
vào cùng kèo → quy chiếu = 800 + 200 = 1.000, cap = 200, đã đặt 200 → TỪ CHỐI.
(Không lách được cap bằng cách đặt nhiều lần nhỏ.)

### A5.4. Đặt nhiều cửa & Brier per-pool

- User được rải token trên NHIỀU cửa cùng kèo. Trước giờ khóa được: thêm token,
  chuyển token giữa các cửa. KHÔNG rút token về ví [MẶC ĐỊNH — xem P3].
  Mọi lần điều chỉnh ghi event `bet_adjust` kèm snapshot.
- Khi resolve: `p_i = token user đặt cửa i / tổng token user đặt kèo đó`;
  `o_i = 1` nếu cửa i thắng, ngược lại 0. **Brier = Σ(p_i − o_i)²** (thang 0–2).
  Ví dụ: đặt 60 @ cửa 1, 40 @ cửa 3 (kèo 4 cửa), cửa 1 thắng →
  Brier = (0,6−1)² + 0² + 0,4² + 0² = 0,32.
- Brier ghi vào bảng riêng theo (user, market, pool). Rank pool = trung bình
  Brier có trọng số nghiêng kèo gần đây (mặc định trọng số giảm dần 0,9^n theo
  thứ tự kèo mới → cũ trong pool; tham số để trong config, có version).
  Dưới 5 kèo resolved trong pool → `Unranked`. v0.1: tính + lưu, KHÔNG hiển thị.
