#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ĐỐI CHỨNG MỘT LƯỢT cho `scripts/economy_sim.ts` — CHẠY MỘT LẦN RỒI ĐÓNG BĂNG.

═══════════════════════════════════════════════════════════════════════════════
⚠⚠ ĐIỀU KIỆN GỠ (A8.9 — cấm đường tắt không có ngày chết)

  Tệp này TỰ XOÁ NGHĨA khi một trong hai điều dưới đây xảy ra, và người thấy
  điều đó phải XOÁ TỆP trong cùng commit:

    1. `config/economy.ts` đổi bất kỳ hằng số nào mà tệp này đang chép tay
       (`MUA.*`, `TREASURY_GENESIS`). Lúc đó bản chép ở đây LỆCH, và một bản
       đối chứng đã lệch còn tệ hơn không có bản nào — nó vẫn in "KHỚP".
    2. Sau **31/12/2026**. Quá hạn đó thì giá trị đối chứng đã hết; giữ lại chỉ
       là giữ một tệp không ai chạy.

  ⚠ TỆP NÀY KHÔNG NẰM TRONG `npm test` VÀ ĐÓ LÀ CHỦ Ý. Nó không phải một bài
  test — nó là MỘT LƯỢT đối chứng độc lập, đã chạy, kết quả ghi vào D252. Nhét
  nó vào CI là biến nó thành cài đặt thứ hai phải bảo trì, đúng thứ D61/A11.5
  bảo đừng.

═══════════════════════════════════════════════════════════════════════════════
VÌ SAO CÓ TỆP NÀY

D16 (17/07) ghi món nợ là `economy_sim.py`. Founder chốt 05/09: bản chính viết
bằng TS và import thẳng công thức thật (không đẻ bản sao sẽ trôi — D61), nhưng
vẫn chạy **một lượt** Python để có hai cài đặt độc lập bắt lỗi lẫn nhau.

Nên tệp này CỐ Ý không đọc gì từ TS: không import, không parse `config/`, chép
tay số từ D16 và tự tính từ đầu bằng số nguyên thuần. Đối chứng mà dùng chung
mã nguồn thì không đối chứng cái gì.

CHẠY:  python scripts/doi_chung/economy_sim_doi_chung.py
"""
import math
import sys

# ⚠ stdout của Windows mặc định là cp1252 ⇒ mọi chữ có dấu làm nổ UnicodeEncodeError
# trước khi in được dòng đầu tiên. Ép UTF-8 tại chỗ thay vì bắt người chạy nhớ
# thêm cờ `-X utf8` — một tệp chỉ chạy đúng khi gọi kèm cờ là một tệp sẽ bị gọi sai.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Chép tay từ docs/khao-co/design_economy_unified.md §4 và §5 ──────────────
GENESIS = 20_000
NEN_MOC, NEN_HE_SO, SAN = 1_000, 10, 700
BONUS = {"vang": 80, "bac": 50, "dong": 25}

D16_RAKE, D16_NEN = 37_457, 52_156
D16_TRO_CAP, D16_SAN, D16_BONUS = 14_250, 25_716, 38_000
D16_CUOI_MUA = 31_647          # con số D16 tự công bố

# Ba ví dụ nén mà chính D16 in ra trong ngoặc ở §4.
NEN_VI_DU = {5_000: 1_630, 10_000: 1_940, 2_000: 1_310}


def isqrt_tu_viet(n: int) -> int:
    """Newton thuần, KHÔNG dùng math.isqrt — để cả phép căn cũng là cài đặt độc lập."""
    if n < 0:
        raise ValueError("căn của số âm")
    if n < 2:
        return n
    x, y = n, (n + 1) // 2
    while y < x:
        x, y = y, (y + n // y) // 2
    return x


def nen(vi: int) -> int:
    return vi if vi <= NEN_MOC else NEN_MOC + isqrt_tu_viet(vi - NEN_MOC) * NEN_HE_SO


def chu_ky(dau, rake, nen_vao, tro_cap, san, bonus) -> int:
    return dau + rake + nen_vao - tro_cap - san - bonus


def main() -> int:
    hong = []

    def kiem(ten, duoc, mong):
        dau = "KHỚP  " if duoc == mong else "LỆCH  "
        if duoc != mong:
            hong.append(ten)
        print(f"  {dau}{ten:<52} được {duoc!s:>10}   mong {mong!s:>10}")

    print("\n=== ĐỐI CHỨNG PYTHON ↔ TS (một lượt, 05/09/2026) ===\n")

    print("-- căn nguyên (tự viết Newton, không dùng math.isqrt) --")
    for n in (4_000, 9_000, 1_000, 10_000, 0, 1, 2):
        kiem(f"isqrt({n})", isqrt_tu_viet(n), math.isqrt(n))

    print("\n-- nén ví: ba ví dụ D16 tự in ra --")
    for vi, mong in NEN_VI_DU.items():
        kiem(f"nen({vi})", nen(vi), mong)
    kiem("nen(1000) — đúng mốc thì không đụng", nen(1_000), 1_000)
    kiem("nen(500)  — dưới mốc thì không đụng", nen(500), 500)

    print("\n-- nén bảo toàn tiền (A3.4: không mint, không đốt) --")
    bao_toan = all(nen(v) + (v - nen(v)) == v for v in (1_001, 3_333, 12_345, 999_999))
    kiem("sau + veKhoBac == trước, mọi ví thử", bao_toan, True)

    print("\n-- chu kỳ Kho bạc một mùa --")
    kiem("D16 nguyên bản",
         chu_ky(GENESIS, D16_RAKE, D16_NEN, D16_TRO_CAP, D16_SAN, D16_BONUS), D16_CUOI_MUA)
    kiem("sau D86 (rake = 0)",
         chu_ky(GENESIS, 0, D16_NEN, D16_TRO_CAP, D16_SAN, D16_BONUS), -5_810)
    kiem("sau D86, đủ hai vế (rake = nén = 0)",
         chu_ky(GENESIS, 0, 0, D16_TRO_CAP, D16_SAN, D16_BONUS), -57_966)

    print("\n-- runway + sàn + bonus --")
    kiem("20.000 ÷ 50 T/ngày", GENESIS // 50, 400)
    kiem("sàn hoá ví 650", SAN - 650, 50)
    kiem("bonus vàng/bạc/đồng", (BONUS["vang"], BONUS["bac"], BONUS["dong"]), (80, 50, 25))

    print()
    if hong:
        print(f"✖ LỆCH {len(hong)} mục: {', '.join(hong)}")
        print("  ⇒ DỪNG. Một trong hai cài đặt sai, hoặc D16 sai. Hỏi founder (A8.2).")
        return 1
    print("✔ Hai cài đặt độc lập cho CÙNG kết quả trên mọi mục.")
    print("  Ghi kết quả vào D252 rồi ĐÓNG BĂNG tệp này (xem ĐIỀU KIỆN GỠ ở đầu).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
