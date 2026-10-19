# Delphi — web client (`web/`)

React PWA, mobile-first, with a pixel-art "terminal" visual language (tokens in `src/styles/tokens.css`). The client **never computes money** (prices, payouts and caps come from the server); it renders what the API returns.

| path | what is there |
|---|---|
| `src/` | screens, components, API client (`src/api/`), local personal-finance vault code (`src/pfm/`) |
| `worker/` | the Cloudflare Worker: static assets, same-origin `/api` proxy, queue gate, counters |
| `src/demo/` | an **in-browser demo**: the real server and an in-memory PostgreSQL (PGlite) run inside a Web Worker, so the app can be shown with no backend and no account |
| `tests/` | component and logic tests, golden comparisons against design demos |
| `public/_headers` | CSP and security headers for the SPA shell |

## Run

From the repository root (see the root README for the database and API):

```bash
npm run web:dev          # Vite dev server on :5173, proxies /api to :8787 (same-origin, so cookies work)
npm --prefix web test    # Vitest
npm --prefix web run typecheck
npm --prefix web run build
npm --prefix web run demo:dev    # in-browser demo mode
```

Some tests import server code (the demo mode runs the real `createApp`), so install the root dependencies as well: `npm ci && (cd web && npm ci)`.
