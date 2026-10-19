/**
 * ĐO TRẦN ĐỒNG THỜI — script tải đầu tiên của repo (§7 `docs/gioi-han-ha-tang.md`).
 *
 * ─── VÌ SAO TỒN TẠI ─────────────────────────────────────────────────────────
 * `CONG.TRAN_TRONG = 150` mang nhãn PLAYTEST-TUNE từ D207: nó chọn theo D64
 * ("mẫu số là mùa này ~150 người"), KHÔNG theo sức chịu đo được. §7 viết sẵn
 * cách đo nhưng "repo chưa có script tải nào". Đây là script đó.
 *
 * ─── VÌ SAO ĐO `/health` CHỨ KHÔNG `POST /rounds` ───────────────────────────
 * §7 mục 1 muốn một route CÓ TRANSACTION. Nhưng `POST /rounds` ghi `events`,
 * mà `events` append-only (A3.3) và là CỬA MỘT CHIỀU (A11.1): rác bắn vào đó
 * nằm lại vĩnh viễn trong chính thứ là sản phẩm (A1). Không đánh đổi được.
 *
 * `/health` là chỗ đo tốt thứ nhì và có một tính chất không route nào khác có:
 * nó KHAI `tai.pool` của ĐÚNG instance vừa phục vụ mình (`total/idle/waiting`),
 * nên đọc được trạng thái pool từ bên ngoài. Nó cũng nằm trong `MIEN_CONG` của
 * cổng hàng chờ ⇒ đo được sức BACKEND THẬT, không bị chính cổng che mất.
 *
 * ⚠⚠ D444 (28/09) — `tai.pool` GIỜ Ở PHẦN CHI TIẾT CỦA `/health`, ĐÒI HEADER.
 * Review bảo mật 28/09: `/health` KHÔNG header công khai chỉ còn
 * `{status, ban_phat_hanh}` — `tai.pool` (thứ script này đọc) chỉ trả về khi
 * request kèm `x-tick-secret` khớp bí mật đã cấu hình trên server (xem khối
 * chú thích D444 ở `server/app.ts` ngay trên route `/api/v1/health`). Script
 * đọc `TICK_SECRET` từ biến môi trường (biến CÓ SẴN — cùng secret founder đã
 * đặt cho cron-job.org gọi `/internal/tick`, không đẻ secret mới); thiếu biến
 * thì vẫn bắn được (đo trần KẾT NỐI/INSTANCE ở mã HTTP vẫn đúng), nhưng KHÔNG
 * còn đọc được `pool`/`cho_toi_da`/`lanh` — script in MỘT cảnh báo rõ ràng
 * một lần, không lặng lẽ in `undefined`.
 *
 * ⚠ HẠN CỦA PHÉP ĐO — đọc trước khi trích số: `/health` chạm DB một–hai câu và
 * KHÔNG mở transaction. Nó tìm được trần KẾT NỐI/INSTANCE, KHÔNG tìm được trần
 * THÔNG LƯỢNG GIAO DỊCH. Trần thật của đường có transaction chỉ THẤP HƠN, không
 * bao giờ cao hơn. Nên số ra ở đây là TRẦN TRÊN, dùng để bác chứ không để hứa.
 *
 * ─── ĐI ĐƯỜNG CHÍNH (D78) ───────────────────────────────────────────────────
 * Mặc định bắn qua Cloudflare Worker, đúng đường người dùng đi, không tắt qua
 * origin Vercel.
 *
 * Dùng:
 *   TICK_SECRET=... npx tsx scripts/do_tai_dong_thoi.ts
 *   TICK_SECRET=... npx tsx scripts/do_tai_dong_thoi.ts --muc 30,60,120 --url https://...
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const URL_MAC_DINH = 'https://dubao.example.workers.dev';
const DUONG = '/api/v1/health';
/** Nghỉ giữa hai mức để đợt trước không đè lên đợt sau. */
const NGHI_MS = 3_000;
/** D444: thiếu biến này thì vẫn đo được mã HTTP, nhưng /health chỉ trả công khai. */
const TICK_SECRET = process.env.TICK_SECRET;

interface KetQua {
  ms: number;
  status: number;
  loi?: string;
  pool?: { total: number; idle: number; waiting: number; max: number };
}

export function phanVi(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i] ?? 0;
}

async function motPhat(url: string): Promise<KetQua> {
  const t0 = performance.now();
  try {
    // D444: không có TICK_SECRET thì header rỗng — fetch bỏ qua header undefined,
    // /health vẫn trả 200 nhưng chỉ phần công khai (không có `tai`).
    const headers: Record<string, string> = { 'cache-control': 'no-cache' };
    if (TICK_SECRET) headers['x-tick-secret'] = TICK_SECRET;
    const res = await fetch(url, { headers });
    const body = (await res.json()) as { tai?: { pool?: KetQua['pool'] } };
    const kq: KetQua = { ms: performance.now() - t0, status: res.status };
    if (body.tai?.pool !== undefined) kq.pool = body.tai.pool;
    return kq;
  } catch (err) {
    return { ms: performance.now() - t0, status: 0, loi: (err as Error).message };
  }
}

async function mucDo(url: string, n: number): Promise<void> {
  const t0 = performance.now();
  const kq = await Promise.all(Array.from({ length: n }, () => motPhat(url)));
  const tuong = performance.now() - t0;

  const ok = kq.filter((k) => k.status === 200);
  const ms = ok.map((k) => k.ms);
  const cho = kq.reduce((m, k) => Math.max(m, k.pool?.waiting ?? 0), 0);
  const lanh = kq.filter((k) => k.pool !== undefined && k.pool.total === 0).length;
  const loi = kq.filter((k) => k.status !== 200);

  /*
   * ⚠ KIỂM CHÍNH PHÉP ĐO TRƯỚC KHI TIN SỐ (A11.6 — "xanh một mình không nói gì").
   * Nếu tầng HTTP của Node âm thầm xếp hàng thay vì bắn song song thì mọi con số
   * dưới là số của phép đo TUẦN TỰ đội lốt đồng thời. Đồng thời thật ⇒ thời gian
   * cả đợt xấp xỉ request CHẬM NHẤT, không phải tổng.
   */
  const tong = ms.reduce((a, b) => a + b, 0);
  const thatSuSongSong = tuong < tong * 0.6;

  const dong = [
    `n=${String(n).padStart(3)}`,
    `ok=${ok.length}/${n}`,
    `p50=${phanVi(ms, 50).toFixed(0)}ms`,
    `p95=${phanVi(ms, 95).toFixed(0)}ms`,
    `p99=${phanVi(ms, 99).toFixed(0)}ms`,
    `max=${Math.max(0, ...ms).toFixed(0)}ms`,
    `cho_toi_da=${cho}`,
    `lanh=${lanh}`,
    `ca_dot=${(tuong / 1000).toFixed(2)}s`,
    thatSuSongSong ? '' : '⚠ CHƯA SONG SONG THẬT',
  ].filter((s) => s !== '');
  console.log('  ' + dong.join('  '));

  if (loi.length > 0) {
    const gom = new Map<string, number>();
    for (const l of loi) {
      const k = l.loi ?? `HTTP ${l.status}`;
      gom.set(k, (gom.get(k) ?? 0) + 1);
    }
    for (const [k, v] of gom) console.log(`      ✖ ${v}× ${k}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doc = (co: string, mac: string): string => {
    const i = args.indexOf(co);
    return i >= 0 ? (args[i + 1] ?? mac) : mac;
  };
  const goc = doc('--url', URL_MAC_DINH);
  const mucs = doc('--muc', '10,30,60,120,200,300')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const url = `${goc}${DUONG}`;
  const tongReq = mucs.reduce((a, b) => a + b, 0);
  console.log(`ĐO TRẦN ĐỒNG THỜI — ${url}`);
  console.log(`Các mức: ${mucs.join(', ')}  ⇒  tổng ${tongReq} request`);
  console.log(`⚠ Tốn quota Vercel: ${tongReq} trong ~33.000/ngày (${((tongReq / 33000) * 100).toFixed(1)}%)`);
  if (!TICK_SECRET) {
    // D444: MỘT cảnh báo rõ, một lần — không để `cho_toi_da=0`/`lanh=0` giả
    // (thiếu số thật, không phải "pool rảnh") lẫn vào bảng số như thể đã đo được.
    console.log(
      '⚠⚠ THIẾU TICK_SECRET ⇒ /health chỉ trả công khai, KHÔNG có `tai.pool` — ' +
      'cột `cho_toi_da`/`lanh` dưới đây sẽ LUÔN LÀ 0, không phải vì pool rảnh. ' +
      'Đặt biến TICK_SECRET (cùng secret đã cấu hình cho /internal/tick) để đo được.',
    );
  }
  console.log('');

  for (const n of mucs) {
    await mucDo(url, n);
    await new Promise((r) => setTimeout(r, NGHI_MS));
  }

  console.log('');
  console.log('Đọc bảng: `cho_toi_da` > 0 ⇒ pooler đã bắt request xếp hàng (chạm trần');
  console.log('kết nối). `lanh` = số request rơi vào instance vừa bung (cold start).');
  console.log('p99 vọt lên ~10s ⇒ chạm connectionTimeoutMillis của pool.');
}

const LA_CLI =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (LA_CLI) {
  await main();
}
