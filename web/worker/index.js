/**
 * Worker phục vụ frontend "Dự báo" + proxy same-origin /api → Vercel API,
 * + CỔNG HÀNG CHỜ chống quá tải (31/08, D207).
 *
 * Vì sao proxy (chỉ đạo GĐ5 §6): cookie phiên là SameSite=Lax — nếu frontend
 * và API khác site, fetch POST không mang cookie → auth vỡ. Proxy làm browser
 * thấy MỘT origin duy nhất; đổi hosting API sau này = đổi đúng hằng số dưới
 * đây (A8.9 — không khóa vendor, không viết lại logic).
 *
 * ─── CỔNG: VÌ SAO Ở ĐÂY CHỨ KHÔNG PHẢI TRONG APP ───────────────────────────
 * Thứ gãy đầu tiên khi đông người là KẾT NỐI DB (~15 qua pooler Supabase
 * free), gãy trong vài giây. Bộ chặn tần suất hiện có chạy TRÊN DB nên từ
 * chối một request tốn gần bằng phục vụ nó — nó là bộ đếm công bằng, không
 * phải bộ chắn tải. Cổng phải đứng trước DB và không được đụng DB. Worker là
 * chỗ duy nhất thoả, và miễn phí (C1). Luật ở `cong.js`, sổ ở `cua.js`.
 *
 * ─── HAI CỬA THOÁT, CẢ HAI ĐỀU MỞ TOANG (fail-open) ────────────────────────
 * Thiếu `CONG_BI_MAT` hoặc thiếu binding `CUA` ⇒ **TẮT CỔNG**, mọi request đi
 * thẳng như trước. Cùng nếp `PROXY_SHARED_SECRET` (server/app.ts): một cái
 * cổng cấu hình sai mà khoá chết cả app thì tệ hơn nhiều lần một cái cổng
 * không chạy. Muốn biết cổng có sống không thì xem header `x-dp-cong` trên
 * mọi phản hồi API: `tat` · `vao` · `cho`.
 */
import { CONG } from './cong.js';
import { SUAT_TRAN } from '../../config/suat_tran.ts';

export { CuaHang } from './cua.js';
import { boDemMoi, ghiLuot } from './dem.js';

/** Bộ đếm lượt gọi Vercel CỦA ISOLATE NÀY (D594 — luật ở dem.js). Biến module sống theo isolate, có chủ ý. */
const BO_DEM = boDemMoi();

/** Xả lô đếm lên sổ. Không bao giờ ném — sổ đếm hỏng không được làm hỏng request của người chơi. */
async function xaDem(env, n) {
  try {
    await env.CUA.get(env.CUA.idFromName('dem-v1')).fetch(`https://cua/dem?n=${n}`, { method: 'POST' });
  } catch (e) {
    console.error('dem loi (bo qua):', e && e.message);
  }
}

/** Số lượt tháng này trên sổ — chỉ đọc khi chuyển tiếp `/api/v1/canh`. Hỏng ⇒ null (máy chủ bỏ phép kiểm quota). */
async function docDem(env) {
  try {
    const r = await env.CUA.get(env.CUA.idFromName('dem-v1')).fetch('https://cua/dem');
    const j = await r.json();
    return Number.isFinite(j.so) ? j.so : null;
  } catch {
    return null;
  }
}

const API_ORIGIN = 'https://api.example.vercel.app';

/*
 * KHÔNG BAO GIỜ CHẶN BỐN NHÓM NÀY — mỗi dòng một lý do khác nhau, đừng gộp:
 *  · `_cong`    — chính cái cổng. Chặn nó là nhốt người trong hàng vĩnh viễn.
 *  · `health`   — UptimeRobot. Chặn là tự báo động "sập" trong khi đang sống.
 *  · `internal` — cron khoá kèo + backup đêm (C3: phải chạy kể cả 0 người
 *                 online). Đã có secret riêng gác; chặn thêm là mất kèo/mất
 *                 backup đúng lúc đông người nhất.
 *  · `/admin`   — founder phải xem được bảng số TRONG LÚC đang cháy. Cổng mà
 *                 chặn cả người đi chữa cháy thì nó là một phần của đám cháy.
 */
const MIEN_CONG = [
  '/api/v1/_cong',
  '/api/v1/_suat',
  '/api/v1/health',
  '/api/v1/internal/',
];

/*
 * DANH SÁCH TRẮNG CACHE — HẸP CÓ CHỦ Ý, ĐỪNG NỚI KHI CHƯA ĐỌC HẾT ĐOẠN NÀY.
 *
 * ⚠⚠ Gần như MỌI endpoint của app đều theo user và xác thực bằng COOKIE. Cache
 * ở biên theo URL cho một endpoint như thế là **phát ví của người này cho
 * người khác** — không phải lỗi hiệu năng, là lỗ rò phiên. Rà 31/08: chỉ đúng
 * hai đường công khai, không đọc cookie, không đổi theo người:
 *   · /avatar/catalog — danh mục tĩnh (server đã tự đặt max-age=300)
 *   · /health         — trạng thái sống
 * Thêm đường mới vào đây thì phải CHỨNG MINH nó không đọc phiên. Ba lá chắn
 * dưới `nenCache()` là để cứu người quên, không phải để thay việc chứng minh.
 */
const CACHE_TRANG = ['/api/v1/avatar/catalog', '/api/v1/health'];
const CACHE_GIAY = 30;

const enc = new TextEncoder();

/** Chỉ cache khi CHẮC CHẮN không có gì riêng tư dính vào. */
export function nenCache(request, url) {
  if (request.method !== 'GET') return false;
  if (!CACHE_TRANG.includes(url.pathname)) return false;
  // Có cookie/authorization ⇒ có thể là phản hồi riêng. Không đoán, không cache.
  if (request.headers.get('cookie') || request.headers.get('authorization')) return false;
  /*
   * ⚠⚠ D444 (28/09) — `/health` KHÔNG CÒN "một URL, một câu trả lời".
   *
   * Từ D444, thân `/health` công khai chỉ có `{status, ban_phat_hanh}`, còn
   * thân CHI TIẾT (admin_allowlist, tải pool, nhịp scheduler…) chỉ trả khi
   * request mang `x-tick-secret` khớp. Cache biên khoá theo URL, KHÔNG theo
   * header ⇒ một cú kiểm chi tiết đi qua Worker (đúng cách `.env.example`
   * hướng dẫn, vì chỉ qua Worker mới đọc được `tin_duoc_ip: true`) sẽ bị cất
   * 30 giây và PHÁT LẠI cho bất kỳ ai gọi `/health` trong 30 giây đó — tức
   * đúng thứ D444 vừa giấu đi, rò ra ở tầng mà route không nhìn thấy.
   * Bắt được ở bước rà bản vá, trước khi lên prod.
   * Có header này ⇒ không đọc cache, không ghi cache. Không so giá trị: header
   * sai thì server trả thân công khai, nhưng không đáng lấy cache làm chỗ đoán.
   */
  if (request.headers.has('x-tick-secret')) return false;
  return true;
}

/**
 * Phản hồi này có được cất vào cache biên không — tách khỏi `luuCache` để bài
 * test gọi thẳng được (luuCache chạm `caches.default`, thứ chỉ có trên Cloudflare).
 */
export function catDuocVaoCache(res) {
  // `set-cookie` ⇒ phản hồi có thể riêng cho một người: tuyệt đối không cache.
  if (!res.ok || res.headers.has('set-cookie')) return false;
  // 204/205 ⇒ cấm có thân, dựng Response kèm thân là ném (cùng bẫy ở dưới).
  if (res.status === 204 || res.status === 205) return false;
  /*
   * D444 — LÁ CHẮN THỨ HAI, cho người quên lá chắn thứ nhất: upstream đã nói
   * `no-store`/`private` thì biên KHÔNG được cất. Trước D444 `luuCache` tự
   * đặt `max-age` đè lên mà không đọc upstream nói gì — nên một route lỡ đổi
   * thân theo header (như `/health` chi tiết) chỉ còn trông vào danh sách ở
   * `nenCache`. Nay route tự bảo vệ được mình bằng một header chuẩn.
   */
  if (/\b(no-store|private)\b/i.test(res.headers.get('cache-control') ?? '')) return false;
  return true;
}

/* ── Vé thông hành: ký cục bộ, kiểm cục bộ, KHÔNG gọi Durable Object ────────
 *
 * Mỗi request mà phải hỏi DO thì DO thành nút cổ chai mới. Nên vé là một chuỗi
 * HMAC tự chứng minh: Worker kiểm bằng WebCrypto ngay tại biên (không mạng,
 * không state), chỉ khi vé HẾT HẠN mới hỏi DO một lần. Với hạn 60 giây, tải
 * lên DO là ~(số người)/60 lượt mỗi giây — 3.000 người ⇒ ~50/giây.
 */
/*
 * ⚠⚠ PHẢI CÓ CẢ `verify`, KHÔNG CHỈ `sign` — sự cố prod 06/09 (D293).
 *
 * Bản cũ khai `['sign']`. Ký thì chạy; `kiemVe` gọi `crypto.subtle.verify` bằng
 * đúng khoá đó thì WebCrypto ném `InvalidAccessError: Requested key usage
 * "verify" does not match any usage listed in this CryptoKey`.
 *
 * Hình dạng hỏng rất dễ đọc nhầm thành "chập chờn": request ĐẦU TIÊN không có
 * cookie nên không kiểm gì cả ⇒ 200, rồi Worker phát `dp_pass`; MỌI request sau
 * mang cookie đó ⇒ 500. Tức người lạ mở lần đầu thì thấy trang, còn người đang
 * dùng thì hỏng — đúng nhóm khó thấy nhất khi kiểm bằng cách gõ thẳng URL.
 */
async function khoa(bem) {
  return crypto.subtle.importKey(
    'raw', enc.encode(bem), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function kyVe(ve, hetHan, bem) {
  const than = `${ve}.${hetHan}`;
  const sig = await crypto.subtle.sign('HMAC', await khoa(bem), enc.encode(than));
  return `${than}.${b64url(sig)}`;
}

/**
 * Kiểm vé. Trả `null` nếu hỏng/hết hạn/không khớp mã vé.
 * ⚠ So sánh chữ ký bằng `crypto.subtle.verify` chứ không phải `===` chuỗi:
 * so chuỗi rò thời gian, và ở đây chữ ký là thứ duy nhất chặn người tự phát vé
 * cho mình để nhảy hàng.
 */
export async function kiemVe(pass, ve, bem, now) {
  if (!pass) return null;
  const p = pass.split('.');
  if (p.length !== 3) return null;
  const [veCuaVe, hetHanStr, sigStr] = p;
  if (veCuaVe !== ve) return null;
  const hetHan = Number(hetHanStr);
  if (!Number.isFinite(hetHan) || hetHan <= now) return null;
  /*
   * ⚠⚠ KHÔNG ĐƯỢC NÉM — fail-open, cùng nếp `hoiCua` (D293).
   *
   * Sự cố 06/09: `crypto.subtle.verify` ném `InvalidAccessError` và KHÔNG ai
   * bắt, nên mọi request mang cookie thành 500. Nghịch lý là lời gọi Durable
   * Object ngay bên dưới ĐÃ có `try/catch` với đúng lý lẽ *"cửa hỏng ⇒ mở
   * toang, không phải khoá lại"* — tác giả đã lường trước cửa hỏng, nhưng
   * không lường CRYPTO hỏng. Một cơ chế chống sập tự thành nguyên nhân sập.
   *
   * Docstring ngay trên đã hứa "trả `null` nếu HỎNG"; khối này làm code khớp
   * lời nó tự viết. An toàn không đổi: vé không kiểm được thì KHÔNG được vào
   * bằng vé — nó rơi xuống nhánh hỏi cổng như một người chưa có vé.
   */
  let ok = false;
  try {
    const sig = Uint8Array.from(
      atob(sigStr.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0),
    );
    ok = await crypto.subtle.verify(
      'HMAC', await khoa(bem), sig, enc.encode(`${veCuaVe}.${hetHanStr}`),
    );
  } catch (e) {
    console.error('kiem ve loi, coi nhu khong co ve:', e && e.message);
    return null;
  }
  return ok ? hetHan : null;
}

function docCookie(request, ten) {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  for (const phan of raw.split(';')) {
    const [k, ...v] = phan.trim().split('=');
    if (k === ten) return v.join('=');
  }
  return null;
}

/*
 * `SameSite=None; Secure` — BẮT BUỘC, không phải tuỳ chọn: app còn chạy trong
 * iframe Discord Activity, mà `Lax` chết trong ngữ cảnh xuyên site (đây đúng
 * là lý do repo phải thêm đường `Authorization: Bearer`). Cookie cổng là cookie
 * kỹ thuật — không danh tính, không PII (C7) — nên `None` ở đây không mở thêm
 * bề mặt nào.
 */
function datCookie(headers, ten, gt, tuoiS) {
  headers.append('set-cookie',
    `${ten}=${gt}; Path=/; Max-Age=${tuoiS}; Secure; HttpOnly; SameSite=None`);
}

function maNgauNhien() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ── SUẤT TRẬN (SPEC `docs/spec/tran-tran-ngay.md`) ───────────────────────
 *
 * Hàng chờ thứ HAI, chỉ cho đúng một đường: TẠO TRẬN. Thứ khoá Vercel 30 ngày
 * là GB-giờ của dòng nhịp minigame (9 màn × 41 s × 2 GB mỗi trận), tức số
 * TRẬN — không phải số người vào app (cổng trên lo đồng thời). Luật ở
 * `suat.js`, số ở `config/suat_tran.ts`, sổ ở instance `suat-v1` của `CuaHang`.
 *
 * ⚠ FAIL-OPEN y như cổng: DO lỗi ⇒ cho qua; lưới trần ngày ở server chặn trên.
 */
export const DUONG_TAO_TRAN = '/api/v1/holdem/matches';

/** Cookie phiên đăng nhập của API (`config/auth.ts` SESSION_COOKIE) — chỉ để BĂM, Worker không đọc danh tính. */
const COOKIE_PHIEN = 'delphi_session';

/**
 * Dấu phiên = 32 ký tự đầu sha256(token phiên) — cookie web HOẶC `Bearer` (Activity Discord, cùng thứ tự
 * `docTokenPhien` ở server). Vé miễn suất GẮN với dấu này: đăng xuất / đổi tài khoản trên cùng máy ⇒ vé cũ hết khớp.
 */
export async function dauPhien(request) {
  let t = docCookie(request, COOKIE_PHIEN);
  if (!t) {
    const h = request.headers.get('authorization');
    if (h && h.startsWith('Bearer ')) t = h.slice(7).trim();
  }
  if (!t) return null;
  const bam = await crypto.subtle.digest('SHA-256', enc.encode(t));
  return [...new Uint8Array(bam)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Hỏi sổ suất trận. Instance riêng — không tranh nhịp với cổng vào app. */
async function hoiSuat(env, duong, thamSo = {}) {
  const id = env.CUA.idFromName('suat-v1');
  const q = new URLSearchParams(thamSo).toString();
  const res = await env.CUA.get(id).fetch(`https://cua/suat/${duong}${q ? `?${q}` : ''}`);
  return res.json();
}

/** 503 hàng chờ suất trận — cùng nếp `hang_cho` (client đọc `Retry-After` sẵn). Chữ hiển thị ở client (A11.9). */
function traHangChoTran(kq, ve) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  h.set('Retry-After', String(kq.hoi_lai_s ?? SUAT_TRAN.HOI_LAI_MIN_S));
  h.set('cache-control', 'no-store');
  h.set('x-dp-cong', 'cho_suat');
  // Mã vé PHẢI bền qua các lần hỏi lại — nó là chỗ đứng trong hàng.
  datCookie(h, 'dp_ve', ve, 86400);
  return new Response(JSON.stringify({
    error: 'hang_cho_tran',
    message: kq.het_ngay
      ? 'Hôm nay đã hết suất trận — mở lại lúc 0:00.'
      : 'Đang đông — bạn đang xếp hàng chờ suất trận.',
    hang_cho_tran: {
      vi_tri: kq.vi_tri,
      tong: kq.tong,
      du_kien: kq.du_kien ?? null,
      het_ngay: kq.het_ngay === true,
      mo_lai_luc: kq.mo_lai_luc,
      hoi_lai_s: kq.hoi_lai_s,
    },
  }), { status: 503, headers: h });
}

/** Hỏi Durable Object. Một sổ duy nhất toàn cầu ⇒ tên cố định. */
async function hoiCua(env, ve) {
  const id = env.CUA.idFromName('cong-v1');
  const res = await env.CUA.get(id).fetch(
    `https://cua/?ve=${encodeURIComponent(ve)}`,
  );
  return res.json();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // /api/* và /admin đều đẩy sang API. /admin phải đi qua ĐÂY (không phải
    // asset tĩnh) để: (a) route Hono + requireAdmin thực sự chạy, (b) cookie
    // phiên gửi kèm được vì browser vẫn thấy cùng một origin.
    const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');
    const isAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');

    if (isApi || isAdmin) {
      const congSong = !!(env.CONG_BI_MAT && env.CUA);
      const canGac = congSong && isApi
        && !MIEN_CONG.some((p) => url.pathname === p.replace(/\/$/, '')
          || url.pathname.startsWith(p));

      // Mã vé: cookie sẵn có, hoặc phát mới. KHÔNG phải danh tính người dùng —
      // chỉ là số thứ tự xếp hàng, sinh ngẫu nhiên, không nối được với ai (C7).
      let ve = docCookie(request, 'dp_ve');
      let veMoi = false;
      if (!ve || !/^[0-9a-f]{32}$/.test(ve)) {
        ve = maNgauNhien();
        veMoi = true;
      }

      let trangThaiCong = congSong ? 'vao' : 'tat';
      let passMoi = null;

      if (canGac) {
        const pass = docCookie(request, 'dp_pass');
        const conHan = await kiemVe(pass, ve, env.CONG_BI_MAT, Date.now());
        if (!conHan) {
          // Vé hết hạn / chưa có ⇒ hỏi cổng MỘT lần.
          let kq;
          try {
            kq = await hoiCua(env, ve);
          } catch (e) {
            /*
             * ⚠ CỬA HỎNG ⇒ MỞ TOANG, KHÔNG PHẢI KHOÁ LẠI. Một Durable Object
             * lỗi mà làm cả app không vào được là biến cơ chế chống sập thành
             * nguyên nhân sập. Ghi log rồi cho qua.
             */
            console.error('cua loi, mo toang:', e && e.message);
            kq = { vao: true, han_s: CONG.HAN_PASS_S };
          }

          if (kq.vao) {
            const hetHan = Date.now() + (kq.han_s ?? CONG.HAN_PASS_S) * 1000;
            passMoi = await kyVe(ve, hetHan, env.CONG_BI_MAT);
          } else {
            // ─── ĐANG XẾP HÀNG ───────────────────────────────────────────
            // 503 + Retry-After: `web/src/api/client.ts` đã đọc sẵn cả mã lỗi
            // lẫn `Retry-After` (thuộc tính `retryAfterSeconds`), nên màn hàng
            // chờ không cần một hình dạng lỗi thứ hai.
            const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
            h.set('Retry-After', String(kq.hoi_lai_s ?? CONG.NHIP_HOI_S));
            h.set('cache-control', 'no-store');
            h.set('x-dp-cong', 'cho');
            datCookie(h, 'dp_ve', ve, 86400);
            return new Response(JSON.stringify({
              error: 'hang_cho',
              message: 'Đang đông người. Bạn đang xếp hàng, giữ tab này mở nhé.',
              hang_cho: {
                vi_tri: kq.vi_tri,
                tong: kq.tong,
                dang_trong: kq.dang_trong,
                tran: kq.tran,
                hoi_lai_s: kq.hoi_lai_s ?? CONG.NHIP_HOI_S,
              },
            }), { status: 503, headers: h });
          }
        }
      }

      // ── Số suất trận cho `/admin` — chỉ đếm, không danh tính (C7) ────────
      if (url.pathname === '/api/v1/_suat') {
        const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
        h.set('cache-control', 'no-store');
        if (!congSong) return new Response(JSON.stringify({ cong: 'tat' }), { headers: h });
        try {
          return new Response(JSON.stringify({ cong: 'bat', ...(await hoiSuat(env, 'thong-ke')) }), { headers: h });
        } catch (e) {
          console.error('suat loi (thong ke):', e && e.message);
          return new Response(JSON.stringify({ cong: 'loi' }), { headers: h });
        }
      }

      // ── Suất trận: chỉ POST tạo trận, admin miễn, đếm bằng 201 thật ──────
      let giuSuat = false;
      if (congSong && request.method === 'POST' && url.pathname === DUONG_TAO_TRAN) {
        const dau = await dauPhien(request);
        const mien = dau
          ? await kiemVe(docCookie(request, 'dp_mien'), `m${dau}`, env.CONG_BI_MAT, Date.now())
          : null;
        if (!mien) {
          let kq = null;
          try {
            kq = await hoiSuat(env, 'xin', { ve });
          } catch (e) {
            // Sổ suất hỏng ⇒ cho qua (fail-open); lưới trần ngày ở server chặn trên.
            console.error('suat loi, mo toang:', e && e.message);
          }
          if (kq && kq.vao === false) return traHangChoTran(kq, ve);
          giuSuat = !!kq;
        }
      }

      // ── Cửa hỏi trạng thái cổng (client gọi khi đang xếp hàng) ───────────
      if (url.pathname === '/api/v1/_cong') {
        const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
        h.set('cache-control', 'no-store');
        h.set('x-dp-cong', congSong ? 'vao' : 'tat');
        datCookie(h, 'dp_ve', ve, 86400);
        if (!congSong) {
          return new Response(JSON.stringify({ cong: 'tat', vao: true }), { headers: h });
        }
        let kq;
        try {
          kq = await hoiCua(env, ve);
        } catch (e) {
          console.error('cua loi, mo toang:', e && e.message);
          kq = { vao: true, han_s: CONG.HAN_PASS_S };
        }
        if (kq.vao) {
          const hetHan = Date.now() + (kq.han_s ?? CONG.HAN_PASS_S) * 1000;
          datCookie(h, 'dp_pass', await kyVe(ve, hetHan, env.CONG_BI_MAT),
            kq.han_s ?? CONG.HAN_PASS_S);
        } else {
          h.set('x-dp-cong', 'cho');
          h.set('Retry-After', String(kq.hoi_lai_s ?? CONG.NHIP_HOI_S));
        }
        return new Response(JSON.stringify({ cong: 'bat', ...kq }), { headers: h });
      }

      // ── Cache: chỉ hai đường công khai, chỉ khi không mang cookie ────────
      const dungCache = nenCache(request, url);
      if (dungCache) {
        const hit = await caches.default.match(request);
        if (hit) return hit;
      }

      const upstream = new URL(url.pathname + url.search, API_ORIGIN);
      const headers = new Headers(request.headers);
      // BẮT BUỘC bỏ host + cf-* của request gốc: giữ nguyên là Cloudflare tưởng
      // fetch quay về chính worker → chặn đệ quy, lỗi 1042 (đã dính khi deploy đầu)
      headers.delete('host');
      /*
       * B12 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — header NỘI BỘ (`x-delphi-*` · `x-dp-*`) chỉ Worker được đặt. Bản cũ
       * chép nguyên header client nên `x-dp-dem-thang: 1` client tự gửi lọt tới `/canh` mỗi khi Durable Object đếm lỗi
       * (lúc đó nhánh dưới không ghi đè) — đi kèm secret THẬT của Worker nên máy chủ tin ⇒ chuông quota tắt bằng số giả.
       * Xoá hết TRƯỚC khi gắn của mình: thứ gì Worker không gắn thì origin không nhận.
       */
      for (const k of [...headers.keys()]) {
        if (k.startsWith('cf-') || k.startsWith('x-delphi-') || k.startsWith('x-dp-')) headers.delete(k);
      }
      // IP thật của client cho rate-limit đăng ký phía API.
      // KHÔNG dùng x-forwarded-for: Vercel GHI ĐÈ header đó bằng IP edge của
      // Cloudflare → mọi user chung PoP dính chung bucket (đã xảy ra 18/07).
      // Header riêng + secret dùng chung: API chỉ tin khi secret khớp, nên
      // người gọi thẳng api.example.vercel.app không giả được IP để né giới hạn.
      const ip = request.headers.get('cf-connecting-ip');
      if (ip) {
        headers.set('x-delphi-client-ip', ip);
        headers.set('x-forwarded-for', ip); // giữ cho tương thích/log
      }
      /*
       * B1 — secret đi kèm MỌI request lên origin, không chỉ khi có `cf-connecting-ip`: API nay từ chối `/api/*` thiếu
       * secret (cổng proxy, `server/app.ts`), nên request đi ĐÚNG cửa mà thiếu header IP (đường nội bộ Cloudflare,
       * preview) không được thành 403. API chỉ tin IP khi CÓ CẢ HAI header, nên gắn secret không kèm IP vẫn an toàn.
       */
      if (env.PROXY_SHARED_SECRET) {
        headers.set('x-delphi-proxy-secret', env.PROXY_SHARED_SECRET);
      }

      /*
       * Đếm ĐÚNG lượt đi tới Vercel (D594): sau cache, sau cổng. `/canh` mang theo số của sổ — chỉ khi có proxy secret,
       * vì máy chủ chỉ tin header này khi secret khớp (cùng luật `x-delphi-client-ip`).
       */
      if (env.CUA) {
        const xa = ghiLuot(BO_DEM);
        if (xa > 0) ctx.waitUntil(xaDem(env, xa));
        if (url.pathname === '/api/v1/canh' && env.PROXY_SHARED_SECRET) {
          const so = await docDem(env);
          if (so !== null) {
            headers.set('x-dp-dem-thang', String(so + BO_DEM.cho)); // secret đã gắn ở trên (B1)
          }
        }
      }
      // Lượt bị hàng chờ suất trận giữ lại đã `return` 503 ở trên ⇒ không tới đây, không đếm là lượt Vercel.

      let res;
      try {
        res = await fetch(upstream, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'manual',
        });
      } catch (e) {
        // Vercel không trả lời ⇒ trả suất về quỹ ngay (không đợi hạn giữ), rồi ném như cũ.
        if (giuSuat) ctx.waitUntil(hoiSuat(env, 'bao', { ve, ok: '0' }).catch(() => undefined));
        throw e;
      }
      // Đếm bằng 201 THẬT: lỗi không ăn suất. `waitUntil` — người chơi không phải đợi sổ ghi xong.
      if (giuSuat) {
        ctx.waitUntil(hoiSuat(env, 'bao', { ve, ok: res.status === 201 ? '1' : '0' })
          .catch((e) => console.error('suat loi (bao):', e && e.message)));
      }

      /*
       * Phải dựng Response mới để gắn cookie/header cổng — headers của Response
       * do `fetch` trả về là bất biến.
       *
       * Cổng TẮT thì thoát sớm, không tốn một lần sao chép nào — đường chạy
       * hôm nay (chưa bật) giống hệt bản cũ. Cổng BẬT thì luôn gắn `x-dp-cong`
       * kể cả khi không có cookie mới: đó là cách DUY NHẤT biết cổng còn sống
       * mà không phải dựng tải thật để thử.
       */
      if (!congSong && !veMoi) {
        if (dungCache) ctx.waitUntil(luuCache(request, res));
        return res;
      }
      /*
       * ⚠ KHÔNG ĐƯỢC truyền thân cho status cấm-có-thân — `new Response(body, ...)`
       * với 204/205/304 là **ném TypeError**, tức một cú 304 bình thường từ upstream
       * sẽ thành lỗi 500 do chính cái cổng gây ra. Chỉ xảy ra khi cổng BẬT, nên
       * nó là loại lỗi chỉ lộ ra đúng lúc đông người nhất.
       */
      const khongThan = res.status === 204 || res.status === 205 || res.status === 304;
      const out = new Response(khongThan ? null : res.body, res);
      out.headers.set('x-dp-cong', trangThaiCong);
      /*
       * VÉ MIỄN SUẤT cho admin (tester ⊂ admin). Worker không biết ai là admin — phiên là token mờ, DB mới
       * giải được — nên SERVER báo bằng header `x-dp-mien-suat` trên phản hồi của request đã xác thực
       * (`requireAuth`), và Worker đổi nó thành cookie KÝ, gắn với dấu phiên. Header chỉ tới từ upstream
       * (Worker tự gọi `API_ORIGIN`), người dùng không chèn được; vé ký bằng `CONG_BI_MAT` nên không tự phát.
       * Bóc header khỏi phản hồi ra ngoài: client không cần biết.
       */
      if (congSong && out.headers.get('x-dp-mien-suat') === '1') {
        const dau = await dauPhien(request);
        if (dau) {
          const hetHan = Date.now() + SUAT_TRAN.HAN_VE_MIEN_S * 1000;
          datCookie(out.headers, 'dp_mien', await kyVe(`m${dau}`, hetHan, env.CONG_BI_MAT),
            SUAT_TRAN.HAN_VE_MIEN_S);
        }
      }
      out.headers.delete('x-dp-mien-suat');
      if (veMoi) datCookie(out.headers, 'dp_ve', ve, 86400);
      if (passMoi) datCookie(out.headers, 'dp_pass', passMoi, CONG.HAN_PASS_S);
      if (dungCache) ctx.waitUntil(luuCache(request, out));
      return out;
    }

    /*
     * Còn lại: asset tĩnh của SPA (fallback single-page cấu hình ở wrangler.jsonc).
     *
     * ⭐ VÀ ĐÂY LÀ LÝ DO CỔNG NÀY DÙNG ĐƯỢC: asset tĩnh do Cloudflare trả THẲNG
     * Ở BIÊN, không gọi worker, không đụng Vercel, không đụng DB. Nghĩa là vỏ
     * app luôn tải được kể cả khi cổng đang đóng — người xếp hàng nhìn thấy
     * một màn hàng chờ thật của app, không phải một trang lỗi trần của trình
     * duyệt. Không có tính chất này thì hàng chờ vô nghĩa.
     *
     * ⚠ KHÔNG đặt header cache cho vỏ HTML ở đây — ĐO RỒI, KHÔNG ĂN. Lớp
     * static-assets của Cloudflare trả asset THẲNG Ở BIÊN mà không gọi worker
     * (`run_worker_first` mặc định false), nên mọi header set trong hàm này với
     * request HTML đều là code chết. Đã thử 25/07: đặt `no-store` + xoá ETag,
     * deploy, rồi curl vẫn thấy `public, max-age=0, must-revalidate`.
     * Luật cache của asset nằm ở `public/_headers` — xem lý do trong file đó.
     */
    return env.ASSETS.fetch(request);
  },
};

/** Lưu bản sao vào cache biên. Không bao giờ ném — cache hỏng ≠ request hỏng. */
async function luuCache(request, res) {
  try {
    if (!catDuocVaoCache(res)) return;
    const ban = new Response(res.clone().body, res);
    ban.headers.set('cache-control', `public, max-age=${CACHE_GIAY}`);
    await caches.default.put(request, ban);
  } catch (e) {
    console.error('cache loi (bo qua):', e && e.message);
  }
}
