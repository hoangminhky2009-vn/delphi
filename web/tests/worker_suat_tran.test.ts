// @vitest-environment node
/**
 * ĐƯỜNG WORKER CỦA SUẤT TRẬN — `web/worker/index.js` + `cua.js` + `suat.js` ghép lại (SPEC `docs/spec/tran-tran-ngay.md` mục 5).
 *
 * `suat_tran_cong.test.ts` khoá LUẬT; bài này khoá chỗ luật được NỐI vào đường thật, nơi một hàng chờ đúng luật vẫn vô dụng nếu:
 *   · hết suất mà Worker vẫn gọi Vercel (cả cơ chế để KHÔNG đốt GB-giờ)
 *   · lỗi của Vercel ăn mất suất (đếm bằng 201 THẬT)
 *   · admin bị xếp hàng như người thường, hoặc NGƯỜI THƯỜNG mượn được vé miễn của admin
 *   · sổ suất hỏng làm chết luôn việc tạo trận (phải fail-open — lưới server chặn trên)
 * Durable Object chạy THẬT trong bộ nhớ (lớp `CuaHang`), chỉ Vercel là giả.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error — worker là JS thuần, không có khai báo kiểu cho index.js
import worker, { DUONG_TAO_TRAN } from '../worker/index.js';
// @ts-expect-error — như trên
import { CuaHang } from '../worker/cua.js';
import { quyLuyKe } from '../../config/suat_tran';

const GOC = 'https://dubao.example.workers.dev';
/** 10:00 giờ VN ngày 12/10/2026 — bảng giờ thật cho quỹ luỹ kế `quyLuyKe(10)`. */
const MUOI_GIO_VN = Date.UTC(2026, 9, 12, 3, 0);
const QUY_10H = quyLuyKe(10);

type DoGia = { fetch: (u: string, init?: RequestInit) => Promise<Response> };

function dungEnv(opts: { suatHong?: boolean } = {}) {
  const kho = new Map<string, unknown>();
  const state = {
    storage: { get: async (k: string) => kho.get(k), put: async (k: string, v: unknown) => { kho.set(k, v); } },
    blockConcurrencyWhile: (f: () => Promise<void>) => f(),
  };
  const inst = new Map<string, InstanceType<typeof CuaHang>>();
  const env = {
    CONG_BI_MAT: 'bi-mat-thu-nghiem',
    CUA: {
      idFromName: (ten: string) => ten,
      get: (ten: string): DoGia => ({
        fetch: async (u: string, init?: RequestInit) => {
          if (opts.suatHong && ten === 'suat-v1') throw new Error('DO hỏng');
          if (!inst.has(ten)) inst.set(ten, new CuaHang(state, {}));
          return inst.get(ten)!.fetch(new Request(u, init));
        },
      }),
    },
  };
  return { env, kho };
}

/** Vercel giả: đếm số lần bị gọi; trả 201 (hoặc mã cho trước) + header cho trước. */
function vercelGia(status = 201, them: Record<string, string> = {}) {
  const goi = { n: 0, ma: status };
  vi.stubGlobal('fetch', vi.fn(async () => {
    goi.n += 1;
    return new Response(JSON.stringify({ match_id: `m${goi.n}` }), {
      status: goi.ma, headers: { 'content-type': 'application/json', ...them },
    });
  }));
  return goi;
}

const ve = (i: number) => i.toString(16).padStart(32, '0');

async function goi(env: unknown, duong: string, init: RequestInit & { cookie?: string } = {}) {
  const cho: Promise<unknown>[] = [];
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  const res: Response = await worker.fetch(
    new Request(new URL(duong, GOC), { method: init.method ?? 'GET', headers, body: init.body }),
    env, { waitUntil: (p: Promise<unknown>) => cho.push(p) },
  );
  await Promise.all(cho);
  return res;
}

const taoTran = (env: unknown, i: number, them = '') =>
  goi(env, DUONG_TAO_TRAN, { method: 'POST', body: '{}', cookie: `dp_ve=${ve(i)}${them}` });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MUOI_GIO_VN);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hết suất ⇒ xếp hàng, KHÔNG gọi Vercel', () => {
  it(`10h VN có ${QUY_10H} suất: người thứ ${QUY_10H + 1} nhận 503 hang_cho_tran có số thứ tự + giờ dự kiến`, async () => {
    expect(QUY_10H).toBeGreaterThan(0);
    const { env } = dungEnv();
    const v = vercelGia();
    for (let i = 1; i <= QUY_10H; i += 1) expect((await taoTran(env, i)).status).toBe(201);
    expect(v.n).toBe(QUY_10H);

    const res = await taoTran(env, 99);
    expect(res.status).toBe(503);
    expect(v.n).toBe(QUY_10H); // ⭐ không một lời gọi Vercel nào cho người đang chờ
    expect(res.headers.get('x-dp-cong')).toBe('cho_suat');
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThanOrEqual(5);
    const than = await res.json() as { error: string; hang_cho_tran: Record<string, unknown> };
    expect(than.error).toBe('hang_cho_tran');
    expect(than.hang_cho_tran).toMatchObject({ vi_tri: 1, tong: 1, het_ngay: false });
    expect(than.hang_cho_tran.du_kien).toBeGreaterThan(MUOI_GIO_VN);
  });

  it('chỉ chặn ĐÚNG đường tạo trận — đọc trận, nộp vòng vẫn đi thẳng', async () => {
    const { env } = dungEnv();
    vercelGia();
    for (let i = 1; i <= QUY_10H; i += 1) await taoTran(env, i);
    expect((await goi(env, '/api/v1/holdem/matches/abc', { cookie: `dp_ve=${ve(50)}` })).status).toBe(201);
    expect((await goi(env, '/api/v1/holdem/matches/abc/rounds', {
      method: 'POST', body: '{}', cookie: `dp_ve=${ve(50)}`,
    })).status).toBe(201);
  });
});

describe('sống chung với sổ đếm lượt Vercel (D594)', () => {
  it('⭐ lượt bị hàng chờ giữ lại KHÔNG đếm là lượt gọi Vercel — sổ đếm tăng đúng bằng số lần Vercel bị gọi', async () => {
    const { env, kho } = dungEnv();
    const v = vercelGia(200);
    const soSo = () => Number([...kho.entries()].find(([k]) => k.startsWith('thang:'))?.[1] ?? 0);
    // Mồi: xả phần tồn của các bài trước (bộ đếm sống ở cấp module) vào sổ này, lấy mốc.
    /*
     * Mốc mồi phải SAU lần xả cuối ≥ một nhịp xả — cả lần xả của các bài trước (giờ giả 2026) LẪN mốc bộ đếm module ghi lúc nạp
     * (giờ THẬT). Lấy 10:00 giờ VN năm 2030: cùng giờ ⇒ cùng quỹ giờ, và không bao giờ trôi về trước đồng hồ thật (bản đầu dùng
     * MUOI_GIO_VN + 10′ — xanh lúc viết, ĐỎ khi đồng hồ thật vượt 03:10 UTC 12/10).
     */
    const T = Date.UTC(2030, 0, 15, 3, 0);
    vi.setSystemTime(T);
    await goi(env, '/api/v1/holdem/catalog', { cookie: `dp_ve=${ve(60)}` });
    const moc = soSo();
    const goiMoc = v.n;
    vi.setSystemTime(T + 1_000);
    v.ma = 201;
    for (let i = 1; i <= QUY_10H; i += 1) await taoTran(env, i);
    for (let i = 0; i < 3; i += 1) expect((await taoTran(env, 90 + i)).status).toBe(503);
    vi.setSystemTime(T + 62_000); // qua nhịp xả ⇒ lượt kế xả hết phần chờ
    v.ma = 200;
    await goi(env, '/api/v1/holdem/catalog', { cookie: `dp_ve=${ve(61)}` });
    expect(soSo() - moc).toBe(v.n - goiMoc);
    expect(v.n - goiMoc).toBe(QUY_10H + 1);
  });
});

describe('đếm bằng 201 thật', () => {
  it('Vercel trả lỗi ⇒ suất trả về quỹ, người sau vẫn tạo được', async () => {
    const { env } = dungEnv();
    const v = vercelGia(500);
    for (let i = 1; i <= QUY_10H; i += 1) expect((await taoTran(env, i)).status).toBe(500);
    v.ma = 201;
    expect((await taoTran(env, 77)).status).toBe(201);
  });

  it('bộ đếm 201 được ghi xuống storage (DO khởi động lại không cấp lại cả quỹ ngày)', async () => {
    const { env, kho } = dungEnv();
    vercelGia();
    await taoTran(env, 1);
    expect(kho.get('suat_dem')).toMatchObject({ daDung: 1 });
  });
});

describe('admin miễn — và chỉ admin', () => {
  const PHIEN_ADMIN = 'delphi_session=token-phien-admin';

  async function layVeMien(env: unknown): Promise<string> {
    vercelGia(200, { 'x-dp-mien-suat': '1' });
    const res = await goi(env, '/api/v1/auth/me', { cookie: `dp_ve=${ve(7)}; ${PHIEN_ADMIN}` });
    expect(res.headers.get('x-dp-mien-suat')).toBeNull(); // bóc khỏi phản hồi ra ngoài
    const m = /dp_mien=([^;]+)/.exec(res.headers.get('set-cookie') ?? '');
    expect(m).not.toBeNull();
    return m![1]!;
  }

  it('server báo admin ⇒ Worker phát vé ký; hết suất admin vẫn tạo được trận, không ăn suất', async () => {
    const { env } = dungEnv();
    const mien = await layVeMien(env);
    vercelGia();
    for (let i = 1; i <= QUY_10H; i += 1) await taoTran(env, i);
    expect((await taoTran(env, 98)).status).toBe(503);
    expect((await taoTran(env, 7, `; ${PHIEN_ADMIN}; dp_mien=${mien}`)).status).toBe(201);
  });

  it('⭐ vé miễn GẮN với phiên: mang sang phiên khác (người thường cùng máy) ⇒ vẫn xếp hàng', async () => {
    const { env } = dungEnv();
    const mien = await layVeMien(env);
    vercelGia();
    for (let i = 1; i <= QUY_10H; i += 1) await taoTran(env, i);
    const res = await taoTran(env, 7, `; delphi_session=token-nguoi-khac; dp_mien=${mien}`);
    expect(res.status).toBe(503);
  });

  it('vé tự chế (không ký bằng bí mật cổng) không qua được', async () => {
    const { env } = dungEnv();
    vercelGia();
    for (let i = 1; i <= QUY_10H; i += 1) await taoTran(env, i);
    const gia = `mabc.${Date.now() + 3_600_000}.chu-ky-gia`;
    expect((await taoTran(env, 7, `; ${PHIEN_ADMIN}; dp_mien=${gia}`)).status).toBe(503);
  });
});

describe('fail-open', () => {
  it('sổ suất hỏng ⇒ vẫn tạo được trận (lưới trần ngày ở server chặn trên)', async () => {
    const { env } = dungEnv({ suatHong: true });
    const v = vercelGia();
    for (let i = 1; i <= QUY_10H + 3; i += 1) expect((await taoTran(env, i)).status).toBe(201);
    expect(v.n).toBe(QUY_10H + 3);
  });

  it('cổng tắt (thiếu bí mật) ⇒ không xếp hàng suất', async () => {
    const { env } = dungEnv();
    const v = vercelGia();
    const tat = { ...env, CONG_BI_MAT: undefined };
    for (let i = 1; i <= QUY_10H + 3; i += 1) expect((await taoTran(tat, i)).status).toBe(201);
    expect(v.n).toBe(QUY_10H + 3);
  });
});

describe('/api/v1/_suat cho /admin', () => {
  it('trả số đếm, không danh tính', async () => {
    const { env } = dungEnv();
    vercelGia();
    await taoTran(env, 1);
    const t = await (await goi(env, '/api/v1/_suat')).json() as Record<string, unknown>;
    expect(t).toMatchObject({ cong: 'bat', da_dung: 1, gio_vn: 10, dang_cho: 0 });
    expect(JSON.stringify(t)).not.toMatch(/[0-9a-f]{32}/);
  });
});
