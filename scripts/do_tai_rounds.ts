/**
 * ĐO TẢI ĐƯỜNG CÓ TRANSACTION — `POST /matches` · `POST /rounds` trên DB THỨ HAI (`docs/gioi-han-ha-tang.md`
 * §"Vì sao nâng lên 300": điều kiện để nâng `CONG.TRAN_TRONG` quá 300).
 *
 * ─── VÌ SAO KHÔNG BAO GIỜ CHẠY VÀO PROD ─────────────────────────────────────
 * `POST /rounds` ghi `events` — append-only, cửa một chiều (A3.3 · A11.1). Rác bắn vào đó nằm lại vĩnh viễn
 * trong chính thứ là sản phẩm. Nên script này có HAI chốt cứng, không có cờ lách:
 *   · URL đích không được là cửa prod (`CUA_PROD`);
 *   · `DATABASE_URL` (dùng để tạo người giả) không được trỏ project Supabase prod (`REF_PROD`).
 * Đích mặc định: `delphi-api-thu` (Vercel project riêng) → Supabase `delphi-thu` (project 2, D?? — 11/10).
 *
 * ─── ĐO GÌ ──────────────────────────────────────────────────────────────────
 * Mỗi mức N: N người giả CÙNG LÚC `POST /matches` → `GET /shop` → `POST /rounds` (vòng 1). Ba pha tách nhau
 * (đợi pha trước xong) để đọc riêng sức chịu từng route. Đi thẳng origin Vercel, KHÔNG qua Worker: Worker thử
 * (`dubao-thu`) chưa có, và Worker chỉ chuyển tiếp — trần đang tìm là pooler + transaction phía sau nó. Lệch D78
 * này ghi rõ trong kết quả.
 *
 * Dùng (DB thử ở `.env.thu` cây chính — mật khẩu không bao giờ in ra):
 *   npx tsx --env-file=../../../.env.thu scripts/do_tai_rounds.ts --muc 10,30,60
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { createTestUser, type TestUser } from '../tests/helpers/fixtures.js';
import { phanVi } from './do_tai_dong_thoi.js';

const URL_MAC_DINH = 'https://api-staging.example.vercel.app';
/** Cửa prod — chặn cứng, không cờ lách (A3.3). */
export const CUA_PROD = ['dubao.example.workers.dev', 'api.example.vercel.app'];
export const REF_PROD = '<project-ref>';
const NGHI_MS = 4_000;
// B1 (D613): đích là origin Vercel ⇒ phải mang proxy secret như Worker (PROXY_SHARED_SECRET của project thử trong .env.thu).
const DAU_PROXY: Record<string, string> = process.env.PROXY_SHARED_SECRET
  ? { 'x-delphi-proxy-secret': process.env.PROXY_SHARED_SECRET } : {};

export function kiemDich(url: string, dbUrl: string | undefined): string[] {
  const loi: string[] = [];
  const host = new URL(url).host;
  if (CUA_PROD.some((h) => host === h || host.endsWith(`.${h}`))) loi.push(`đích ${host} là cửa PROD`);
  if (/delphi-api(-git-[^.]*)?\.vercel\.app$/.test(host) && !host.startsWith('delphi-api-thu')) loi.push(`đích ${host} giống project prod`);
  if (!dbUrl) loi.push('thiếu DATABASE_URL (DB thử)');
  else if (dbUrl.includes(REF_PROD)) loi.push('DATABASE_URL trỏ project Supabase PROD');
  return loi;
}

interface Phat { ms: number; status: number; ma?: string }

async function goi(url: string, cookie: string, init: RequestInit = {}): Promise<Phat & { body?: any }> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', cookie, ...DAU_PROXY, ...(init.headers ?? {}) } });
    const txt = await r.text();
    let body: any; try { body = JSON.parse(txt); } catch { body = undefined; }
    const ma = r.ok ? undefined : String(body?.error?.code ?? body?.code ?? body?.error ?? txt.slice(0, 40));
    return { ms: performance.now() - t0, status: r.status, ...(ma !== undefined ? { ma } : {}), body };
  } catch (e) {
    return { ms: performance.now() - t0, status: 0, ma: (e as Error).message.slice(0, 40) };
  }
}

function tomTat(ten: string, n: number, ds: Phat[], wall: number): string {
  const ok = ds.filter((x) => x.status >= 200 && x.status < 300);
  const ms = ok.map((x) => x.ms);
  const loi = new Map<string, number>();
  for (const x of ds) if (!(x.status >= 200 && x.status < 300)) loi.set(`${x.status}:${x.ma}`, (loi.get(`${x.status}:${x.ma}`) ?? 0) + 1);
  const r = (v: number) => `${Math.round(v)}`;
  return `| ${ten} | ${n} | ${ok.length}/${ds.length} | ${r(phanVi(ms, 50))} | ${r(phanVi(ms, 95))} | ${r(phanVi(ms, 99))} | ${(wall / 1000).toFixed(2)} | ${[...loi].map(([k, v]) => `${k}×${v}`).join(' ') || '—'} |`;
}

async function pha<T>(ds: T[], f: (x: T) => Promise<Phat>): Promise<{ kq: Phat[]; wall: number }> {
  const t0 = performance.now();
  const kq = await Promise.all(ds.map(f));
  return { kq, wall: performance.now() - t0 };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const lay = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const base = (lay('--url') ?? URL_MAC_DINH).replace(/\/$/, '');
  const muc = (lay('--muc') ?? '10,30,60').split(',').map(Number).filter((x) => x > 0);
  const loi = kiemDich(base, process.env.DATABASE_URL);
  if (loi.length) { for (const l of loi) console.error(`✖ ${l}`); console.error('✖ từ chối — script này chỉ chạy trên DB thử (A3.3).'); process.exit(1); }

  const maxN = Math.max(...muc);
  const pool = createPool(process.env.DATABASE_URL!, { max: 6 });
  console.log(`→ tạo ${maxN} người giả trên DB thử (fixture SQL)…`);
  const nguoi: TestUser[] = [];
  // `seq` của fixture đếm lại từ 0 mỗi lần chạy ⇒ tiền tố riêng mỗi lần, kẻo trùng `users_handle_key` với lần trước.
  const tienTo = `t${Date.now().toString(36).slice(-6)}`;
  while (nguoi.length < maxN) {
    const lo = await Promise.all(Array.from({ length: Math.min(6, maxN - nguoi.length) }, () => createTestUser(pool, { tienTo })));
    nguoi.push(...lo);
  }
  await pool.end();

  const api = `${base}/api/v1/holdem/matches`;
  console.log(`\nĐÍCH ${base} (thẳng origin Vercel, KHÔNG qua Worker — lệch D78, xem docstring)\n`);
  console.log('| pha | N | ok | p50 ms | p95 ms | p99 ms | cả đợt s | lỗi |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const n of muc) {
    const ai = nguoi.slice(0, n);
    const tao = await pha(ai, (u) => goi(api, u.cookie, { method: 'POST', body: JSON.stringify({}) }));
    console.log(tomTat('POST /matches', n, tao.kq, tao.wall));
    const tran = ai.map((u, i) => ({ u, id: (tao.kq[i] as any).body?.match_id as string | undefined })).filter((x) => x.id);
    const shop = await pha(tran, (x) => goi(`${api}/${x.id}/shop?lan=0`, x.u.cookie));
    console.log(tomTat('GET /shop', tran.length, shop.kq, shop.wall));
    const nop = await pha(tran, (x, ) => {
      const sh = (shop.kq[tran.indexOf(x)] as any).body?.shop;
      const mua = sh?.chien_thuat?.[0] ? [sh.chien_thuat[0]] : [];
      return goi(`${api}/${x.id}/rounds`, x.u.cookie, { method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua, hanh_dong: 'giu_vi_the', them: 0 }) });
    });
    console.log(tomTat('POST /rounds', tran.length, nop.kq, nop.wall));
    await new Promise((r) => setTimeout(r, NGHI_MS));
  }
  const h = await fetch(`${base}/api/v1/health`, { headers: { ...DAU_PROXY, ...(process.env.TICK_SECRET ? { 'x-tick-secret': process.env.TICK_SECRET } : {}) } }).then((r) => r.json() as Promise<{ tai?: { rounds_60s?: unknown } }>).catch(() => null);
  console.log(`\n/health sau đo: rounds_60s = ${JSON.stringify(h?.tai?.rounds_60s ?? null)}`);
}

const laMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (laMain) await main();
