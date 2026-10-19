/**
 * ĐO VAN QUÁ TẢI TRÊN PROD — phép thử HAI VẾ (D274).
 *
 * ─── VÌ SAO PHẢI HAI VẾ, VÀ VÌ SAO BẢN MỘT VẾ LÀ RỖNG ───────────────────────
 * Bản đầu của phép nghiệm thu này (ghi trong D274) là: bắn tải vào `/health`
 * rồi "đếm 503 thay vì 500". RỖNG, và rỗng theo kiểu khó thấy nhất — nó luôn
 * cho cùng một kết quả bất kể van chạy hay không:
 *
 *   `/health` TỰ `try/catch` quanh mọi truy vấn DB rồi trả 500 qua nhánh
 *   `healthy === false`. Nó KHÔNG BAO GIỜ rơi xuống `app.onError` — mà van thì
 *   sống ở `app.onError`. Bắn vào đó là đo cái van không gác.
 *
 * ⇒ Vế 1 (VẮT CẠN): bắn `--tai` request đồng thời vào `/health`. Việc của nó
 *   chỉ là làm Vercel bung đủ instance để chạm trần 200 client của Supavisor.
 * ⇒ Vế 2 (THĂM): giữa lúc đó, gọi `POST /api/v1/auth/login` với mật khẩu sai —
 *   route CHẠM DB, KHÔNG tự bắt lỗi, nên rơi đúng vào `app.onError`, và không
 *   ghi gì đáng kể. Van chạy ⇒ 503 + `Retry-After`. Van không chạy ⇒ 500.
 *
 * ⚠ Email dùng cho vế thăm là duy nhất mỗi lần gọi, và số lần thăm để MẶC ĐỊNH
 * dưới `LOGIN_MAX_FAILS` (10/15 phút) — dính khoá đăng nhập thì nhận 429 và cả
 * phép đo mất nghĩa, không phải vì van sai mà vì ta tự bịt mắt mình.
 *
 * ─── ĐÒN BẨY LÀ ĐỈNH ĐỒNG THỜI, KHÔNG PHẢI TỔNG LƯỢNG (sửa lần 2, 06/09) ──────
 * ⚠ Lần chạy 2 bắn 1.800 request (3 đợt × 600, cách 400ms) và ra **1.799 mã 200,
 * không một mã 500 nào** — trong khi hôm 05/09 chỉ 800 đã vỡ. Nhiều hơn gấp đôi
 * mà không vỡ, vì tôi sửa sai chiều: giãn đợt là cách để TRÁNH vỡ.
 *
 * Cơ chế: p50 của `/health` là ~300–800ms, mà hai đợt cách nhau 400ms ⇒ đợt
 * trước đã tan gần hết khi đợt sau tới. Đỉnh ĐỒNG THỜI THẬT chỉ quanh 600, thấp
 * hơn hôm qua. Còn hôm qua 800 bay đi trong CÙNG MỘT `Promise.all`, cùng một
 * khoảnh khắc ⇒ Vercel buộc phải bung ngần ấy instance một lúc, mỗi instance một
 * client, và vượt 200.
 *
 * ⇒ **Đòn bẩy duy nhất là số request bay đi CÙNG LÚC.** Tổng lượng không mua
 * được gì; giãn thời gian còn phản tác dụng. Nên mặc định nay là MỘT đợt thật
 * lớn. `--dot` giữ lại nhưng `CACH_DOT_MS = 0`: nhiều đợt nghĩa là CỘNG DỒN vào
 * cùng một khoảnh khắc, không phải rải ra.
 *
 * ⚠ Hệ quả cho D271: đừng trích "800" như một ngưỡng. Nó là ngưỡng của một đợt
 * đồng thời trên hệ đang ấm, không phải ngưỡng của "800 người".
 *
 * ─── VÌ SAO VẪN HÂM NÓNG ────────────────────────────────────────────────────
 * Bản đầu bắn ĐÚNG MỘT đợt 800 vào hệ NGUỘI và ra nhánh "không kết luận được":
 * không lần thăm nào chạm trần. Đọc lại thì rõ vì sao — hôm 05/09 con số 800 vỡ
 * được là vì TRƯỚC nó đã chạy cả thang 10→500, tức instance đang ẤM SẴN. Bắn một
 * phát vào hệ nguội thì Vercel bung instance DẦN, và đợt xong trước khi số
 * instance kịp vượt 200.
 *
 * ⇒ Trần này là trần TỐC ĐỘ BUNG INSTANCE, không phải trần của một con số đồng
 * thời. Nên script phải (a) HÂM NÓNG trước, (b) ép NHIỀU ĐỢT gối nhau để áp lực
 * kéo dài vài giây, (c) THĂM RẢI trong suốt cửa sổ đó thay vì đúng một mốc.
 * Thăm một mốc là bốc thăm: trúng lúc trũng thì báo "van không chạm" mà van vẫn
 * đang tốt.
 *
 * ⚠⚠ SCRIPT NÀY CỐ Ý LÀM PROD HẾT KẾT NỐI TRONG VÀI GIÂY. Chỉ chạy khi đã hỏi
 * founder, và chỉ khi biết chắc không có người chơi thật đang ở trong.
 *
 * Dùng: npx tsx scripts/do_van_qua_tai.ts [--tai 1200] [--dot 1] [--tham 10] [--url ...]
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const URL_MAC_DINH = 'https://dubao.example.workers.dev';
const DUONG_VAT = '/api/v1/health';
const DUONG_THAM = '/api/v1/auth/login';
/** Hâm nóng: bung sẵn một lứa instance trước khi ép thật. */
const HAM_NONG = 300;
/**
 * ⚠ BẰNG 0 LÀ CỐ Ý. Mọi đợt phải bay đi CÙNG MỘT KHOẢNH KHẮC — giãn ra là tự
 * hạ đỉnh đồng thời, tức tự làm phép thử yếu đi (bài học lần chạy 2).
 */
const CACH_DOT_MS = 0;
/** Cửa sổ hết kết nối chỉ kéo dài ~1–2s, nên thăm SỚM và DÀY. */
const THAM_TU_MS = 150;
const CACH_THAM_MS = 200;

interface KqTham {
  status: number;
  retryAfter: string | null;
  ma: string | null;
  ms: number;
}

async function motTham(goc: string, i: number): Promise<KqTham> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${goc}${DUONG_THAM}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `do-van-${Date.now()}-${i}@vi-du.invalid`,
        password: 'mat-khau-sai-co-y',
      }),
    });
    let ma: string | null = null;
    try {
      ma = ((await res.json()) as { error?: string }).error ?? null;
    } catch { ma = null; }
    return { status: res.status, retryAfter: res.headers.get('retry-after'), ma, ms: performance.now() - t0 };
  } catch (err) {
    return { status: 0, retryAfter: null, ma: (err as Error).message, ms: performance.now() - t0 };
  }
}

function dem(xs: readonly number[]): string {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}×${v}`).join('  ');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doc = (co: string, mac: string): string => {
    const i = args.indexOf(co);
    return i >= 0 ? (args[i + 1] ?? mac) : mac;
  };
  const goc = doc('--url', URL_MAC_DINH);
  const tai = Number(doc('--tai', '1200'));
  const soDot = Number(doc('--dot', '1'));
  const soTham = Number(doc('--tham', '10'));
  const tong = HAM_NONG + tai * soDot + soTham;

  console.log(`ĐO VAN QUÁ TẢI — ${goc}`);
  console.log(`  hâm nóng : ${HAM_NONG} request vào ${DUONG_VAT}`);
  console.log(`  vắt cạn  : ${soDot * tai} request bay đi CÙNG LÚC (${soDot}×${tai})`);
  console.log(`  thăm     : ${soTham} lần rải trong đợt, vào ${DUONG_THAM} (mật khẩu sai)`);
  console.log(`⚠ Prod sẽ hết kết nối vài giây. Tốn ~${tong} request (~${((tong / 33000) * 100).toFixed(1)}% ngân sách ngày).`);
  console.log('');

  const banVat = (n: number): Promise<number[]> => Promise.all(
    Array.from({ length: n }, () =>
      fetch(`${goc}${DUONG_VAT}`, { headers: { 'cache-control': 'no-cache' } })
        .then((r) => r.status)
        .catch(() => 0)),
  );

  // Vế 0 — HÂM NÓNG, await hẳn: mục đích là để instance ĐANG SỐNG khi ép thật.
  const t0 = performance.now();
  const nong = await banVat(HAM_NONG);
  console.log(`hâm nóng xong (${((performance.now() - t0) / 1000).toFixed(2)}s) — mã: ${dem(nong)}`);

  // Vế 1 — nhiều đợt GỐI NHAU, KHÔNG await ngay.
  const dots: Promise<number[]>[] = [];
  for (let d = 0; d < soDot; d += 1) {
    dots.push(new Promise<number[]>((res) => {
      setTimeout(() => res(banVat(tai)), d * CACH_DOT_MS);
    }));
  }

  // Vế 2 — THĂM RẢI trong suốt cửa sổ ép.
  const thams = await Promise.all(
    Array.from({ length: soTham }, (_, i) => new Promise<KqTham>((res) => {
      setTimeout(() => res(motTham(goc, i)), THAM_TU_MS + i * CACH_THAM_MS);
    })),
  );
  const vat = (await Promise.all(dots)).flat();

  console.log(`vắt cạn xong — mã: ${dem(vat)}`);
  console.log('');
  console.log('VẾ THĂM — đây mới là câu trả lời:');
  for (const t of thams) {
    console.log(`  HTTP ${t.status}  Retry-After=${t.retryAfter ?? '(không)'}  error=${t.ma ?? '(không)'}  ${t.ms.toFixed(0)}ms`);
  }
  console.log('');

  const co503 = thams.filter((t) => t.status === 503 && t.retryAfter !== null).length;
  const co500 = thams.filter((t) => t.status === 500).length;
  const co429 = thams.filter((t) => t.status === 429).length;
  const vat500 = vat.filter((x) => x === 500).length;

  if (co503 > 0) {
    console.log(`✔ VAN CHẠY: ${co503}/${soTham} lần thăm trả 503 + Retry-After thay vì 500.`);
  } else if (co500 > 0) {
    console.log(`✖ VAN KHÔNG CHẠY: ${co500}/${soTham} lần thăm vẫn trả 500.`);
    process.exitCode = 1;
  } else if (co429 > 0) {
    console.log(`⚠ KHÔNG KẾT LUẬN ĐƯỢC: ${co429} lần thăm ăn 429 (khoá đăng nhập) — chưa chạm van.`);
  } else if (vat500 === 0) {
    console.log('⚠ KHÔNG KẾT LUẬN ĐƯỢC: vế vắt cạn KHÔNG chạm trần lần nào (0 mã 500).');
    console.log('  ⇒ Tăng ĐỈNH ĐỒNG THỜI: --tai 2000. (Đừng tăng --dot kèm giãn — vô ích.)');
    console.log('  Đây KHÔNG phải bằng chứng van hỏng.');
  } else {
    console.log(`⚠ KHÔNG KẾT LUẬN ĐƯỢC: vế vắt cạn CÓ chạm trần (${vat500} mã 500) nhưng không lần`);
    console.log('  thăm nào rơi đúng cửa sổ đó. ⇒ Thăm dày hơn: --tham 16.');
  }
}

const LA_CLI =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (LA_CLI) {
  await main();
}
