# Security

## Reporting

This is a research prototype that is not publicly launched. If you find a vulnerability, please use GitHub's **private vulnerability reporting** on this repository (Security → Report a vulnerability) rather than a public issue. No bounty is offered.

## Security model in brief

| area | design | evidence |
|---|---|---|
| Passwords | argon2id with OWASP-recommended parameters (19 MiB, 2 passes); login timing is balanced so response time does not reveal whether an e-mail exists; e-mail must be verified before login | `config/auth.ts`, `server/auth/crypto.ts`, `tests/dang_nhap_thoi_gian.test.ts` |
| Sessions | 256-bit random token; **only its SHA-256 is stored**; cookie `HttpOnly`, `Secure`, `SameSite=Lax`, plus an `Origin` / `Sec-Fetch-Site` check on every state-changing request; server-side revocation on logout and on password change/reset; reset tokens are single-use and expire in 2 hours | `server/auth/session.ts` |
| Admin | three tiers: role (re-read from the database on every request) + TOTP implemented in-house with RFC 6238 test vectors and replay protection via a monotonic step updated atomically + IP allow-list; irreversible actions require re-authentication within 5 minutes; only an admin can grant admin | `server/admin_bao_mat.ts`, `tests/admin_2fa.test.ts` |
| Rate limits | stored in the database, atomic via advisory locks (a race condition was measured, then fixed); client IP is trusted only when the proxy secret matches | `server/auth/rate_limit.ts` |
| Money | integer arithmetic only; every change through an append-only ledger; `CHECK (balance_after >= 0)`; idempotency keys; transactions with row locks | [ADR-009](docs/adr/ADR-009-invariants-live-in-the-database.md) |
| SQL | parameterised throughout; the few dynamic table/column names come from allow-lists and are quoted | `server/admin_kho.ts`, `server/admin_phan_tich.ts` |
| Front end | CSP without `unsafe-inline` for scripts on the SPA; no `eval`; `dangerouslySetInnerHTML` only for generated SVG | `web/public/_headers` |
| Data at rest | row-level security on every table with no policies (the vendor's public-key REST path is not used); the personal-finance vault is ciphertext whose key never reaches the server and is excluded from backups; nightly backups are AES-256-GCM encrypted | [`docs/dac-ta/04-ha-tang-bao-mat.md`](docs/dac-ta/04-ha-tang-bao-mat.md) |
| Privacy | demographics stored as bands; consent is versioned with an append-only trail; error reporting sends no user id, e-mail or IP | [measurement design](docs/measurement-design.md) |

## What an internal review found, and how each fix was proved

In October 2026 the HTTP API and database were reviewed — by the author with AI assistance — before this repository was prepared for publication (one high-severity and several medium findings; none involved a leaked secret: a pattern search of the working tree and of the full git history for keys, tokens and credentials found none). Every fix below was accepted by **injecting the fault back** and confirming the guarding test turns red ([ADR-011](docs/adr/ADR-011-acceptance-means-breaking-the-code-on-purpose.md)): **17 of 17 injected faults turned tests red for the first package and 24 of 24 for the second**, and the dependency audit gate is clean at the `high` level.

| finding | severity | fix | proving tests |
|---|---|---|---|
| The API origin could be called directly, bypassing the queue gate and cache in front of it, and burning the free-tier quota (every login attempt costs a password hash) | high | `/api/*` requires the Worker's shared-secret header (403 otherwise, before CORS and any route); `/health` answers with two fields and no database access; the Worker strips client-supplied internal headers | `tests/cong_proxy.test.ts`, `web/tests/worker_header_nguon.test.ts` |
| Nightly backup contained account e-mails and password hashes in clear text | medium | AES-256-GCM before leaving the server; no key → no backup is produced; files older than 30 days are deleted (git history of the backup repository still holds older ciphertext — a stated limit); the restore tool decrypts | `tests/backup_ma_hoa.test.ts` |
| Database TLS did not verify the server certificate | medium | pinned CA; `sslmode` in the URL can no longer silently override the setting | `tests/db_tls.test.ts` |
| Guest and Discord accounts could not delete themselves (the delete route demanded a password they never had) | medium | delete with a typed confirmation plus an authenticated session | `tests/xoa_tai_khoan_khach.test.ts` |
| The 16+ age gate existed only on e-mail registration; guest and Discord entry never asked | medium | the gate lives in `requireOnboarded`, so every business door is covered and any door added later is covered too; the two routes a not-yet-confirmed person must reach use a separate guard; the client shows a birth-year prompt before play | `tests/age_gate_moi_duong.test.ts`, `web/tests/tam_hoi_tuoi.test.tsx` |
| State-changing requests relied on `SameSite=Lax` alone against cross-site writes | low | requests with a foreign `Origin`, or `Sec-Fetch-Site: cross-site`, are refused with 403 before routing; the allow-list is the configured app origins plus the project's own Discord Activity host | `tests/csrf_origin.test.ts` |
| An account with a password could not detach a linked Discord identity | low | an unlink route guarded by password verification and the attempt limiter | `tests/discord_go.test.ts` |
| The Discord embedding policy used a wildcard, allowing any Activity to embed the app | low | CSP `connect-src` and `frame-ancestors` pinned to the project's own Activity host; a test keeps the three occurrences identical | `tests/header_bao_mat.test.ts` |
| An authenticated route carried `Cache-Control: public`; looking up a table by code had no rate limit | low | `private`; per-user hourly limiter that also counts guesses that miss | `tests/goi2_va_nho.test.ts` |
| Password change and account deletion had no attempt limit | low | per-account limiter before verification | `tests/mat_khau_gioi_han.test.ts` |
| Console mailer could print token links into logs of a non-production deployment | low | any production-like environment refuses to start without real SMTP; console mailer prints recipient and subject only | `tests/email_console.test.ts` |
| Password reset left other reset links valid | low | using one reset link revokes the others | `tests/auth.test.ts` |
| No global request-body cap | low | 256 KB cap read from `content-length` without consuming the stream | `tests/tran_body.test.ts` |
| Vulnerable dependency versions (one `high`, one `moderate` in the server; two `moderate` remain in the web client's router and are tracked) | high / moderate | upgraded; `npm audit --omit=dev --audit-level=high` gates CI | CI |
| 23 foreign keys had no supporting index; two aggregate tables had no primary key | perf/integrity | migration adding the indexes and keys; guards for future tables | `tests/khoa_ngoai_co_chi_muc.test.ts`, `tests/erd.test.ts` |

Items that are scheduled but not yet shipped are tracked privately and will be added here when they are fixed.
