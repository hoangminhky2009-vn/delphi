# ADR-007 — React to overload; do not guess a threshold

- **Status:** accepted, 2026-09-06 · **Source:** private decision-log entry D274 (follows D271, the first load measurement)
- **Lens:** reliability · distributed-systems thinking

## Context

The first load test of the project (D271) fired 800 concurrent requests through the real path (Cloudflare Worker → Vercel → Supabase). It found the hard ceiling — **200 concurrent clients on the database pooler** — and something worse than the number: the system does not slow down gracefully; past the ceiling it throws `EMAXCONN` and the API answers **HTTP 500**. 689 of 800 succeeded; 111 returned 500. The project's own constraint (C2) says *degrade under control, don't fall over*.

Until then only *measurement* existed (p95 and pool statistics); the load valve did not exist, so "turning it on" meant building it.

## Why not the valve that had been sketched

An earlier sketch (D106) proposed a **threshold valve**: close at ~92 % load, reopen at ~75 %. It cannot be built correctly here:

> **Serverless has no shared memory.** Every number a function can see is about *one instance*. The real ceiling is *global*: 200 pooler clients ≈ 200 live instances. Two hundred instances each see `pool total=1, waiting=0, fine` — **none of them is at 92 % of anything** while the whole fleet is hitting the wall.

A threshold valve reading local numbers is a blind guess, and its own trigger conditions (≥ 50 people/day or p95 > 2 s) had not been met. What changed the answer was learning **how the system fails**, which the sketch did not know.

## Decision — a valve that responds to the event itself

- `laHetKetNoi(err)` recognises "no connection available" by the **message text**, not `err.code`: the pooler returns the generic internal-error code for `EMAXCONN` and for many other errors, so matching on the code would swallow errors that *must* raise alarms. The string was copied verbatim from the production log.
- `app.onError` turns it into **503 + `Retry-After`** with body `error: "qua_tai"`. A 500 is a **lie to the client** ("the server is broken") when the truth is "we are at capacity, come back"; 503 is the one answer every retry layer above understands.
- `Retry-After` is **3–8 seconds with jitter**. A fixed number schedules the whole crowd to return in the same second and recreates the surge that just subsided.
- Error reporting is throttled to **one report per minute per instance**: a surge produces hundreds of identical errors in seconds, and flushing them all into a 5,000-events-per-month alerting quota would **silence the alarm exactly when it is needed**. "We need to *know*, not to *count*."

The valve does not replace the queue gate at the edge: the gate blocks *before* touching the database; the valve only answers politely once it has. Two layers, two jobs.

## A correction kept in the record

D271 had claimed "111 Sentry events". That was wrong: the health-check handler catches its own database errors and returns 500 through its own branch, so nothing reaches the global error handler and no event is created. The measurement had been blind to exactly the case the valve protects — a surge on a *real* route, which does fall into the global handler and produces one event per request. That is the second reason for throttling the reports. The conclusion survived; its location moved.

## Verification

Done with fault injection (see [ADR-011](ADR-011-acceptance-means-breaking-the-code-on-purpose.md)). Later measurements are in [`docs/gioi-han-ha-tang.md`](../gioi-han-ha-tang.md): with a transaction-bearing path on a second database, 800 concurrent requests produced **zero** `EMAXCONN`, and the binding limit turned out to be function *memory-hours*, not connections.
