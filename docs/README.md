# Documentation index

English first. Anything not in English says so; every Vietnamese document has a one-line English summary below. Two kinds of documents exist and are labelled in their headers: **law** (invariants, economy, data rules — the code is checked against them) and **map** (descriptions that may drift; *the code wins*).

## Written in English

| document | what it is |
|---|---|
| [../README.md](../README.md) | project overview and reading paths |
| [architecture.md](architecture.md) | system, request path, trust boundaries, known debt |
| [measurement-design.md](measurement-design.md) | what is recorded, what a number may claim, what is refused |
| [adr/](adr/) | twelve decision records (data, reliability, testing, naming) |
| [naming.md](naming.md) | Vietnamese domain glossary and how to read the comments |
| [../SECURITY.md](../SECURITY.md) | security model, review findings and the tests that prove each fix |
| [api/erd.md](api/erd.md) | **generated** entity-relationship diagrams from the migrations (mermaid), with triggers and RLS per table |
| [api/danh-sach-route.md](api/danh-sach-route.md) | **generated** list of every HTTP route and its middleware (headings Vietnamese, content mostly identifiers) |

## Written in Vietnamese — English summaries

**Law** (the code is checked against these)

| document | summary |
|---|---|
| [luat/02-bat-bien.md](luat/02-bat-bien.md) | The ten invariants: hidden pool before a first bet, sacred resolution, append-only events, no minting of tokens, a permanent firewall between two currencies, seed liquidity split evenly, banned market topics, per-pool Brier ranking, no buying advantage, every balance change through a ledger |
| [luat/03-kinh-te.md](luat/03-kinh-te.md) | Economy parameters and the integer parimutuel formulas, with **hand-computed test vectors** that the tests reproduce |
| [luat/04-du-lieu.md](luat/04-du-lieu.md) | Data model, event catalogue, the `events` ↔ `telemetry` boundary and its one-line test |

**Specifications** (maps — may drift)

| document | summary |
|---|---|
| [dac-ta/00-ban-do.md](dac-ta/00-ban-do.md) | Index of the eight part-specs and who owns which files |
| [dac-ta/01-gameplay.md](dac-ta/01-gameplay.md) | The arena: a match is a pure function of seed, seats, rules and board; round structure; replay as identity |
| [dac-ta/02-ui-ux.md](dac-ta/02-ui-ux.md) | Client: React PWA + Discord Activity, pixel style, client never computes money |
| [dac-ta/03-thu-data.md](dac-ta/03-thu-data.md) | Behavioural data collection |
| [dac-ta/04-ha-tang-bao-mat.md](dac-ta/04-ha-tang-bao-mat.md) | Infrastructure and security: topology, auth, rate limits, headers, backups |
| [dac-ta/05-kinh-te-token.md](dac-ta/05-kinh-te-token.md) | Token economy: two currencies, treasury, burn, shop |
| [dac-ta/06-cho-du-bao-va-admin.md](dac-ta/06-cho-du-bao-va-admin.md) | The original prediction market (now frozen) and the admin panel |
| [dac-ta/07-tai-chinh-ca-nhan.md](dac-ta/07-tai-chinh-ca-nhan.md) | Personal-finance tracking and insight |
| [dac-ta/08-may-tinh-toan.md](dac-ta/08-may-tinh-toan.md) | The calculation machine of the arena: probabilities, correlations and every formula that moves money, pointing to the functions that implement them |
| [yeu-cau-ky-thuat/05b-pfm-kien-truc.md](yeu-cau-ky-thuat/05b-pfm-kien-truc.md) | Architecture of the encrypted spending vault: fifteen decisions (K1–K15), each with alternatives and trade-offs |
| [holdem_math.md](holdem_math.md) | Balance mathematics and the measurement method (Monte Carlo gates, confounding traps, paired twins) |
| [gioi-han-ha-tang.md](gioi-han-ha-tang.md) | Infrastructure limits: every free-tier ceiling, the order they break in, the load tests that measured them — **corrections are left visible** |
| [giai-doan.md](giai-doan.md) | Narrative of the tier ladder; the numbers live in `config/bac_thang.ts` |

**Design decisions** (approved design documents)

| document | summary |
|---|---|
| [thiet-ke-da-chot/](thiet-ke-da-chot/) | Approved design documents for the arena: round loop (Alpha Draft), long-term investing cards, the credit-cycle state machine behind the market map, season journey, short-sell orders, chance events and motivation, betting table and shop, shared tables by seed |
| [spec/bao-loi-nguoi-choi.md](spec/bao-loi-nguoi-choi.md) | One complete specification (player bug reports, anonymous client errors, terms text): user outcome → out of scope → what the author will *see* → machine-checkable criteria → fault-injection plan |
| [ui-ux/demo/](ui-ux/demo/) | Four clickable HTML design demos used as acceptance references: the code is made to match them |

**Not in this repository:** the decision log (about 600 entries), process documentation for working with several AI sessions, legal analysis, status reports and measurement-session kits. They exist in the private working repository; the most instructive decisions are rewritten as [ADRs](adr/).
