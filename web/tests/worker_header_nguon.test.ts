// @vitest-environment node
/**
 * HEADER WORKER GỬI LÊN ORIGIN — B1 + B12 (SPEC `docs/spec/va-bao-mat-chuan-hoa-api-dot-1.md`).
 *
 * B1: API nay TỪ CHỐI mọi `/api/*` thiếu `x-delphi-proxy-secret` (cổng proxy). Trước bản vá Worker chỉ gắn secret khi
 * request có `cf-connecting-ip` — thiếu header đó (đường nội bộ của Cloudflare, bài test, preview) là request tới
 * origin trần ⇒ sau B1 thành 403 cho người đi ĐÚNG cửa. Nay gắn vô điều kiện khi Worker có secret.
 * B12: Worker từng chép NGUYÊN header client (`new Headers(request.headers)`, chỉ bỏ `host`/`cf-*`) ⇒ client tự gửi
 * `x-dp-dem-thang: 1` lọt tới `/canh` mỗi khi Durable Object đếm lỗi (lúc đó Worker không ghi đè) — đi kèm secret thật
 * của Worker nên máy chủ TIN, chuông quota tắt bằng một số giả. Nay mọi `x-delphi-*` · `x-dp-*` của client bị xoá
 * trước khi Worker gắn của mình.
 *
 * Bài chạy `worker.fetch` THẬT với Vercel giả bắt header (nếp `worker_suat_tran.test.ts`).
 * Tiêm ngược: bỏ vòng xoá ⇒ ca B12 đỏ; trả lại điều kiện `if (ip)` quanh secret ⇒ ca B1 đỏ.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error — worker là JS thuần, không có khai báo kiểu cho index.js
import worker from '../worker/index.js';

const GOC = 'https://dubao.example.workers.dev';
const BI_MAT = 'proxy-secret-worker-thu';

function batNguon(): Headers[] {
  const thay: Headers[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init: RequestInit = {}) => {
    thay.push(new Headers(init.headers));
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  return thay;
}

/** Durable Object đếm quota HỎNG ⇒ `docDem` trả null — đúng ca Worker không ghi đè `x-dp-dem-thang`. */
const envDemHong = {
  PROXY_SHARED_SECRET: BI_MAT,
  CUA: { idFromName: (t: string) => t, get: () => ({ fetch: async () => { throw new Error('DO hỏng'); } }) },
};

async function goi(env: unknown, duong: string, headers: Record<string, string> = {}): Promise<void> {
  const cho: Promise<unknown>[] = [];
  await worker.fetch(new Request(new URL(duong, GOC), { headers }), env, { waitUntil: (p: Promise<unknown>) => cho.push(p) });
  await Promise.allSettled(cho);
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('B1 — Worker gắn proxy secret cho MỌI request lên origin', () => {
  it('⭐ không có cf-connecting-ip vẫn mang secret', async () => {
    const thay = batNguon();
    await goi({ PROXY_SHARED_SECRET: BI_MAT }, '/api/v1/auth/me');
    expect(thay[0]!.get('x-delphi-proxy-secret')).toBe(BI_MAT);
  });

  it('có cf-connecting-ip ⇒ secret + IP thật như cũ', async () => {
    const thay = batNguon();
    await goi({ PROXY_SHARED_SECRET: BI_MAT }, '/api/v1/auth/me', { 'cf-connecting-ip': '203.0.113.5' });
    expect(thay[0]!.get('x-delphi-proxy-secret')).toBe(BI_MAT);
    expect(thay[0]!.get('x-delphi-client-ip')).toBe('203.0.113.5');
    expect(thay[0]!.get('cf-connecting-ip')).toBeNull();
  });

  it('/admin cũng mang secret (cùng đường chuyển tiếp)', async () => {
    const thay = batNguon();
    await goi({ PROXY_SHARED_SECRET: BI_MAT }, '/admin');
    expect(thay[0]!.get('x-delphi-proxy-secret')).toBe(BI_MAT);
  });
});

describe('B12 — header nội bộ do client tự gửi bị xoá', () => {
  it('⭐ x-dp-dem-thang giả + DO đếm hỏng ⇒ origin KHÔNG nhận số giả', async () => {
    const thay = batNguon();
    await goi(envDemHong, '/api/v1/canh', { 'x-dp-dem-thang': '1' });
    expect(thay[0]!.get('x-dp-dem-thang')).toBeNull();
    expect(thay[0]!.get('x-delphi-proxy-secret')).toBe(BI_MAT);
  });

  it('⭐ client giả IP / secret ⇒ bị thay bằng của Worker, hoặc mất hẳn', async () => {
    const thay = batNguon();
    await goi({ PROXY_SHARED_SECRET: BI_MAT }, '/api/v1/auth/me', {
      'x-delphi-proxy-secret': 'doan-bua', 'x-delphi-client-ip': '6.6.6.6', 'x-dp-bat-ky': 'x',
    });
    expect(thay[0]!.get('x-delphi-proxy-secret')).toBe(BI_MAT);
    expect(thay[0]!.get('x-delphi-client-ip')).toBeNull();
    expect(thay[0]!.get('x-dp-bat-ky')).toBeNull();
  });

  it('Worker không có secret ⇒ secret client gửi cũng không lọt (không cho mượn danh Worker)', async () => {
    const thay = batNguon();
    await goi({}, '/api/v1/auth/me', { 'x-delphi-proxy-secret': 'doan-bua' });
    expect(thay[0]!.get('x-delphi-proxy-secret')).toBeNull();
  });

  it('header thường của client vẫn đi qua (cookie, authorization, content-type)', async () => {
    const thay = batNguon();
    await goi({ PROXY_SHARED_SECRET: BI_MAT }, '/api/v1/auth/me', { cookie: 'a=b', authorization: 'Bearer t', 'x-khac': '1' });
    expect(thay[0]!.get('cookie')).toBe('a=b');
    expect(thay[0]!.get('authorization')).toBe('Bearer t');
    expect(thay[0]!.get('x-khac')).toBe('1');
  });
});
