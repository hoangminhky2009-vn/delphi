# Naming and domain glossary

Why many identifiers are Vietnamese and what they mean. The decision and its numbers are in [ADR-012](adr/ADR-012-keep-vietnamese-as-the-domain-language.md). Convention in one line: **Vietnamese for domain terms, English for infrastructure terms; no diacritics in identifiers.** (A lesson from the decision log: unaccented Vietnamese creates homophones — `phụ`/`phủ` collide — so grep a new name before using it.)

## Frequent words in identifiers

| Vietnamese | meaning | seen in |
|---|---|---|
| `tran` | match | `holdem_matches`, `taoTran` |
| `vong` | round | `hanh_vi_vong`, `giaiQuyetVong` |
| `ban` | table (a game table) — *also* "sell" in `cho/ban` | `holdem_ban`, `rank_ban` |
| `man` | screen / minigame stage | `holdem_minigame_man`, `man_tap` (practice) |
| `la_bai` | playing card | `la_bai` |
| `la_` as a prefix of a flag | "is" — a boolean | `la_khach` (is guest), `la_tester` (is tester) |
| `khach` | guest | `/auth/khach` |
| `nguoi` | person / human | `rank_ban_nguoi` (human seats) |
| `luu` | store / vault | `pfm_luu` (the encrypted vault) |
| `ngay`, `tuan`, `thang` | day, week, month | `pfm_ngay`, `pfm_tuan`, `telemetry_ngay` |
| `xep_hang`, `bxh` | ranking, leaderboard | `/bxh/*` |
| `ban_the` | numbered collectible item | `vat_pham_ban_the` |
| `kho` | warehouse / store of items | `kho_sticker` |
| `lo` | batch | `telemetry_lo`, `pfm_lo_da_nhan` |
| `cho` | market (frozen prediction market) — or "wait" | `/cho/*` |
| `thu` | try / test / (staging) | `delphi-api-thu` |
| `xoa`, `sua` | delete, edit | route verbs such as `/xoa` |
| `loi` | error | `loi_client`, `bao_loi` (error report) |

## Tables by domain (English gloss)

The full list with one-line meaning per table is generated into [`api/erd.md`](api/erd.md) (domain, columns, foreign keys, triggers) — read that instead of a hand-maintained copy that would drift.

Examples of the convention: `auth_*` (English: identity), `*_ledger` (English: append-only money books), `hanh_vi_*` (behaviour tables derived from events), `pfm_*` (personal-finance vault and features), `rank_*` (ranked play), `telemetry_*` (interface operations).

## Reading the comments

- `D<n>` — entry in the private decision log; the most instructive are rewritten as [ADRs](adr/).
- `A<n>`, `C<n>`, `A11.<n>` — numbered project rules. The invariants, economy and data rules are published in [`luat/`](luat/) (02 invariants · 03 economy with hand-computed test vectors · 04 data model and the `events`/`telemetry` boundary); the rest of the constitution (workflow and legal analysis) is not part of this repository.
- "founder" in a comment means the author (the product owner).
- Quoted founder remarks in comments are kept as evidence of why a rule exists; strong language in them has been masked in this export.
