/**
 * KỊCH BẢN LUỒNG TRÌNH DUYỆT — HUB BENTO (SPEC `docs/spec/ui-tang-khong-gian.md` mục 5 + 5b).
 *
 * Bấm thật trên Chrome (CDP, không thêm thư viện): mở Hub → lớp trượt (Tài chính · Mùa · Lab · banner · Predict · Đấu trường) → đóng
 * (nền · Esc · vuốt) → trả focus → VÀO TRẬN một mục lịch sử → Back/Forward → deep link → trễ mạng (toạ độ khối trước/sau, không số 0) →
 * lỗi + thử lại → mất mạng. Chạy ở 390×812 và 360×640. In BẢNG dòng PASS/FAIL; thoát 1 nếu có dòng đỏ.
 *
 * ⚠ Đây là kịch bản THÔ chạy được ngay (Node ≥ 22, Chrome sẵn có); kịch bản chính thức của B5b (`docs/spec/kiem-luong-trinh-duyet.md`,
 *   playwright-core) sẽ thay vỏ này khi chạy ổn — NỘI DUNG các bước giữ nguyên.
 *
 * CÁCH CHẠY (hai cửa sổ dòng lệnh):
 *   1)  cd web && VITE_DEV_API_PROXY=http://localhost:8799 npx vite --port 5199 --strictPort
 *   2)  node tests/luong/trinh-duyet/hub_bento.mjs            (biến: HUB_URL · HUB_API_PORT · CHROME_PATH · HUB_KHUNG="390x812,360x640")
 * API là BẢN GIẢ ở chính tệp này (không DB, không prod) — chỉ trả `/auth/me` · `/me/nhiem-vu` · điểm danh · telemetry.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const APP = process.env.HUB_URL ?? 'http://localhost:5199/';
const PORT_API = Number(process.env.HUB_API_PORT ?? 8799);
const KHUNG = (process.env.HUB_KHUNG ?? '390x812,360x640').split(',').map((k) => k.split('x').map(Number));
const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

// ─── API GIẢ ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const st = { mode: 'so', lat: 0, off: 0, loi: 0, dd: false, n: {} };
const giu = []; // lat < 0 = GIỮ phản hồi cho tới khi /__ctl?tha=1 (đứng yên để đo, không đua với đồng hồ)
const user = (m) => ({
  user_id: 'u1', handle: 'orca_21', age_band: '19_22', region: 'hn', occupation_band: 'sv', bankroll: 1250, role: 'user',
  research_consent: true, created_at: '2026-10-01T00:00:00Z', season_id: 's0', la_khach: m === 'khach',
});
const VIEC = [
  { nv_id: 'v1', ten: 'Chơi 3 trận Alpha Draft', muc: 3, da: 3, xong: true }, { nv_id: 'v2', ten: 'Ghi sổ 5 ngày', muc: 5, da: 5, xong: true },
  { nv_id: 'v3', ten: 'Chốt sổ tuần', muc: 1, da: 1, xong: true }, { nv_id: 'v4', ten: 'Thử một lá mới', muc: 1, da: 0, xong: false },
];
const lt = () => ({ mua_mo: true, tuan: 3, so_tuan: 4, chang: 2, so_chang: 30, quest_points: 10, viec: VIEC, da_diem_danh_hom_nay: st.dd, moc: [] });
const gui = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const apiGia = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__ctl') { for (const [k, v] of u.searchParams) { if (k === 'mode') st.mode = v; else if (k === 'dd') st.dd = v === '1'; else if (k === 'reset') st.n = {}; else if (k === 'tha') { while (giu.length) giu.shift()(); } else st[k] = Number(v); } return gui(res, 200, st); }
  if (u.pathname === '/__n') return gui(res, 200, st.n);
  if (u.pathname.startsWith('/api/v1/telemetry')) { res.writeHead(202); return res.end('{"ok":true}'); }
  const khoa = `${req.method} ${u.pathname.replace('/api/v1', '')}`;
  st.n[khoa] = (st.n[khoa] ?? 0) + 1;
  const xong = () => {
    if (st.off) { req.socket.destroy(); return; }
    if (st.loi && khoa !== 'GET /auth/me') return gui(res, 500, { error: 'server', message: 'Lỗi giả' });
    if (khoa === 'GET /auth/me') return st.mode === 'chua' ? gui(res, 401, { error: 'unauthorized', message: 'x' }) : gui(res, 200, { email: 'a@b.c', email_verified: true, onboarded: true, user: user(st.mode), pfm: null, buoi_do: null, hoi_nhan_khau: false });
    if (khoa === 'GET /me/nhiem-vu') return gui(res, 200, lt());
    if (khoa === 'POST /me/nhiem-vu/diem-danh') { st.dd = true; return gui(res, 200, lt()); }
    return gui(res, 404, { error: 'not_found', message: 'x' });
  };
  if (st.lat < 0) giu.push(xong); else setTimeout(xong, st.lat);
});
const ctl = (q) => fetch(`http://localhost:${PORT_API}/__ctl?${q}`).then((r) => r.json());
const nmock = () => fetch(`http://localhost:${PORT_API}/__n`).then((r) => r.json());

// ─── CDP TỐI GIẢN (WebSocket có sẵn ở Node ≥ 22) ─────────────────────────────────────────────────────────────────────
async function mo({ w, h, port }) {
  if (!CHROME) throw new Error('Không thấy Chrome — đặt CHROME_PATH');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hubchrome-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu',
    '--hide-scrollbars', '--disable-extensions', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  let info = null;
  for (let i = 0; i < 60 && !info; i += 1) { try { info = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); } }
  if (!info) throw new Error('Chrome không lên');
  const ws = new WebSocket(info.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const cho = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && cho.has(d.id)) { cho.get(d.id)(d); cho.delete(d.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => { id += 1; const i = id; cho.set(i, (d) => (d.error ? rej(new Error(`${method}: ${JSON.stringify(d.error)}`)) : res(d.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  // Oracle (bong bóng toàn cục) mặc định MỞ ở lần đầu và đè nút VÀO TRẬN — đóng sẵn để kịch bản bấm đúng thứ nó định bấm.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('pfm_da_phong_van','1');localStorage.setItem('delphi.oracle',JSON.stringify({mo:false,cau_da_doc:'x'}))" });
  const o = {
    send,
    async go(url) { await send('Page.navigate', { url }); await sleep(400); },
    async js(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception ?? r.exceptionDetails)); return r.result.value; },
    async mouse(type, x, y) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1 }); },
    async tap(x, y, giu = 60) { await o.mouse('mouseMoved', x, y); await o.mouse('mousePressed', x, y); await sleep(giu); await o.mouse('mouseReleased', x, y); },
    async phim(key, code, vk) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); },
    async dong() {
      try { ws.close(); } catch { /* đã đóng */ }
      if (process.platform === 'win32') {
        const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
        for (let i = 0; i < 3; i += 1) { spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' }); await sleep(700); }
      } else { proc.kill('SIGKILL'); await sleep(800); }
      // XOÁ profile sau mỗi lần chụp/chạy (profile Chrome ăn ổ đĩa — bài học 19 lần chụp làm ổ C còn 0 byte).
      for (let i = 0; i < 12; i += 1) { try { fs.rmSync(prof, { recursive: true, force: true }); return; } catch { await sleep(500); } }
      console.error('KHÔNG xoá được profile', prof);
    },
  };
  return o;
}

// ─── KỊCH BẢN ────────────────────────────────────────────────────────────────────────────────────────────────────────
const bang = [];
const ghi = (ten, ok, ct = '') => { bang.push({ ten, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${ten}${ct ? `  — ${ct}` : ''}`); };
const KHOI = ['vi', 'arena', 'tai-chinh', 'mua', 'predict', 'lab', 'vao-tran'];
const DO = `(()=>{const o={};for(const k of ${JSON.stringify(KHOI)}){const e=document.querySelector('[data-o="'+k+'"]');if(!e){o[k]=null;continue;}const b=e.getBoundingClientRect();o[k]=[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)];}const d=document.documentElement;o.cuon=d.scrollHeight-d.clientHeight;return o;})()`;

async function chayKhung(w, h, port) {
  const c = await mo({ w, h, port });
  const chờ = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await c.js(expr)) return true; } catch { /* trang đang nạp */ } await sleep(250); } return false; };
  const tam = (sel) => c.js(`(()=>{const e=document.querySelector('${sel}');if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  const cham = async (sel, giu) => { const p = await tam(sel); if (!p) throw new Error(`không thấy ${sel}`); await c.tap(p.x, p.y, giu); };
  const duong = () => c.js('location.pathname');
  const hopThoai = () => c.js("(()=>{const d=document.querySelector('[role=dialog]');return d?d.textContent:null})()");
  const nutTrong = (re) => c.js(`(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>/${re}/.test(x.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const dongHop = async () => { await c.js("document.querySelector('[role=dialog]')?.querySelector('button:last-of-type')?.click()"); await chờ('!document.querySelector("[role=dialog]")', 3000); };
  const veHub = async () => { await c.js('history.back()'); await chờ("location.pathname==='/' && document.querySelector('[data-o=mua]')", 8000); await sleep(500); };
  const moLai = async (q = 'mode=so&lat=0&off=0&loi=0&dd=0&reset=1') => { await ctl(q); await c.go(APP); await chờ("document.querySelector('[data-o=vi]')?.textContent.match(/[0-9]/) && document.querySelector('[data-o=mua]')?.textContent.match(/[0-9]/)", 40000); await sleep(800); };
  console.log(`\n=== KHUNG ${w}×${h} ===`);
  try {
    await moLai();
    const cuon = await c.js('(()=>{const e=document.documentElement;window.scrollTo(0,500);return {thua:e.scrollHeight-e.clientHeight,y:window.scrollY}})()');
    ghi('không thanh cuộn (scrollHeight − clientHeight = 0)', cuon.thua === 0 && cuon.y === 0, JSON.stringify(cuon));

    await cham('[data-o=vi]');
    ghi('ví token → /vi', await chờ("location.pathname==='/vi'", 4000));
    await veHub();
    ghi('Back từ /vi về Hub, không lớp trượt nào sót', (await duong()) === '/' && (await hopThoai()) === null);
    await c.js('history.forward()');
    ghi('Forward tới /vi', await chờ("location.pathname==='/vi'", 4000));
    await veHub();

    const h0 = await c.js('navigation.currentEntry.index');
    const nut = await tam('[data-o=vao-tran]');
    for (let i = 0; i < 3; i += 1) { await c.mouse('mouseMoved', nut.x, nut.y); await c.mouse('mousePressed', nut.x, nut.y); await c.mouse('mouseReleased', nut.x, nut.y); }
    await chờ("location.pathname==='/arena'", 5000); await sleep(500);
    const h1 = await c.js('navigation.currentEntry.index');
    ghi('VÀO TRẬN bấm 3 lần → /arena, lịch sử +1 đúng một mục', (await duong()) === '/arena' && h1 - h0 === 1, `vị trí lịch sử ${h0}→${h1}`);
    await veHub();
    ghi('Back từ /arena về Hub', (await duong()) === '/');

    await cham('[data-banner]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(700);
    const bk = await hopThoai();
    ghi('chạm banner → lớp bách khoa của mục đang hiện (cảnh đầu: THIÊN NGA ĐEN)', !!bk && /THIÊN NGA ĐEN/.test(bk));
    const q = await c.js("(()=>{const b=document.querySelector('[role=dialog]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+10}})()");
    await c.mouse('mouseMoved', q.x, q.y); await c.mouse('mousePressed', q.x, q.y);
    for (let i = 1; i <= 8; i += 1) { await c.mouse('mouseMoved', q.x, q.y + i * 20); await sleep(16); }
    await c.mouse('mouseReleased', q.x, q.y + 160);
    ghi('vuốt xuống 160 px → lớp đóng', await chờ('!document.querySelector("[role=dialog]")', 3000));
    await cham('[data-banner]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(600);
    const mb = await nutTrong('MỞ BÁCH KHOA'); await c.tap(mb.x, mb.y);
    ghi('MỞ BÁCH KHOA → /bach-khoa/<mục>', await chờ('/^\\/bach-khoa\\//.test(location.pathname)', 5000), await duong());
    await veHub();

    const nhan = await tam('[data-o=arena] > span'); await c.tap(nhan.x + 40, nhan.y, 700);
    await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(600);
    ghi('giữ 0,45 s nhãn ô Đấu trường → lớp mô tả (không "earn token")', !!(await hopThoai()) && !/earn token/i.test(await hopThoai()));
    await dongHop();

    await cham('[data-o=tai-chinh]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(900);
    const tc = await hopThoai();
    ghi('chạm Tài chính → lớp: mô tả + chọn nội dung ô + bàn tiền ghi nhanh', /Ghi thu chi tiền thật/.test(tc ?? '') && /HIỆN TRÊN Ô/.test(tc ?? '') && /CHI/.test(tc ?? ''));
    const mt = await nutTrong('MỞ TÀI CHÍNH'); await c.tap(mt.x, mt.y);
    await chờ("location.pathname!=='/'", 5000); await sleep(800);
    ghi('MỞ TÀI CHÍNH → vào khu /tai-chinh', /^\/tai-chinh/.test(await duong()), await duong());
    await veHub();

    await moLai();
    await cham('[data-o=mua]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(800);
    const dd = await nutTrong('ĐIỂM DANH'); await c.tap(dd.x, dd.y, 30); await c.tap(dd.x, dd.y, 30); await sleep(1500);
    ghi('ĐIỂM DANH bấm đúp → đúng MỘT POST', (await nmock())['POST /me/nhiem-vu/diem-danh'] === 1);
    await dongHop();
    ghi('ô Mùa sau điểm danh: chip ĐÃ ĐIỂM DANH', await chờ("document.querySelector('[data-o=mua]').textContent.includes('ĐÃ ĐIỂM DANH')", 3000));
    await cham('[data-o=mua]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(700);
    const xh = await nutTrong('XEM HÀNH TRÌNH'); await c.tap(xh.x, xh.y);
    ghi('XEM HÀNH TRÌNH → /hanh-trinh', await chờ("location.pathname==='/hanh-trinh'", 5000));
    await veHub();

    await cham('[data-o=predict]');
    ghi('Predict chạm → /du-bao (đi thẳng)', await chờ("location.pathname==='/du-bao'", 5000));
    await veHub();
    await cham('[data-o=predict]', 700); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(600);
    ghi('Predict giữ 0,45 s → lớp mô tả (có Earn Token)', /EARN TOKEN/i.test((await hopThoai()) ?? ''));
    await dongHop();

    await c.js("document.querySelector('[data-o=lab]').focus()");
    await cham('[data-o=lab]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(600);
    ghi('Lab chạm → lắc → lớp "Admin đang chạy thận"', /Admin đang chạy thận/.test((await hopThoai()) ?? ''));
    await c.phim('Escape', 'Escape', 27);
    await chờ('!document.querySelector("[role=dialog]")', 3000);
    ghi('Esc đóng lớp; FOCUS về ô Lab', (await hopThoai()) === null && (await c.js("document.activeElement?.getAttribute('data-o')")) === 'lab');
    await cham('[data-o=lab]'); await chờ('document.querySelector("[role=dialog]")', 3000); await sleep(400);
    await c.tap(w / 2, 30);
    ghi('chạm nền tối → đóng lớp', await chờ('!document.querySelector("[role=dialog]")', 3000));

    const hrefs = await c.js("[...document.querySelectorAll('nav[aria-label=\"Menu chính\"] a')].map(a=>a.getAttribute('href'))");
    ghi('BottomNav đủ 5 tab đúng đích', JSON.stringify(hrefs) === JSON.stringify(['/', '/vi', '/hanh-trinh', '/shop', '/ho-so']));

    await moLai('mode=khach');
    ghi('khách: ô Tài chính không số, có nút ĐĂNG KÝ', !/[0-9]/.test(await c.js("document.querySelector('[data-o=tai-chinh]').textContent")) && !!(await tam('[data-o=dang-ky]')));
    await cham('[data-o=dang-ky]');
    ghi('ĐĂNG KÝ ĐỂ GIỮ TÀI KHOẢN → /onboard', await chờ("location.pathname==='/onboard'", 5000));

    for (const [mode, p] of [['so', 'arena'], ['so', 'hanh-trinh'], ['so', 'bach-khoa/thien_nga'], ['khach', 'arena'], ['so', 'khong-co-trang-nay'], ['chua', '']]) {
      await ctl(`mode=${mode}`); await c.go(APP + p); await chờ('document.body.innerText.length>30', 25000); await sleep(800);
      const ok = (await c.js('document.body.innerText.length')) > 30 && !(await c.js('/Đã xảy ra lỗi|Unexpected Application Error/i.test(document.body.innerText)'));
      ghi(`deep link /${p} (${mode}) mở được → ${await duong()}`, ok);
    }

    // ── trễ mạng: API bị GIỮ rồi thả ──
    await moLai(); await ctl('lat=-1'); await c.go(APP);
    await chờ("document.querySelector('[data-o=mua]') && document.querySelector('[data-o=arena]')", 30000);
    const truoc = await c.js(DO);
    const chuTruoc = await c.js("({vi:document.querySelector('[data-o=vi]').textContent,mua:document.querySelector('[data-o=mua]').textContent})");
    await sleep(1500);                                   // giữ thêm một nhịp: chỗ giữ sẵn phải đứng yên
    await ctl('tha=1&lat=0');
    await chờ("document.querySelector('[data-o=vi]')?.textContent.match(/[0-9]/) && document.querySelector('[data-o=mua]')?.textContent.match(/[0-9]\\/[0-9]/)", 30000);
    await sleep(2000);
    const sau = await c.js(DO);
    const dich = KHOI.filter((k) => truoc[k] && sau[k] && truoc[k].some((v, i) => Math.abs(v - sau[k][i]) > 1)).map((k) => `${k}: ${truoc[k]} → ${sau[k]}`);
    ghi('⭐ API bị GIỮ rồi thả: KHÔNG khối nào mọc/nhảy khi dữ liệu về (toạ độ 7 khối trước = sau ±1 px)', dich.length === 0, dich.join(' | '));
    ghi('đang tải: ví "— T" và ô Mùa "—" — KHÔNG số 0 thay cho "chưa có" (D62)', /—/.test(chuTruoc.vi) && !/[0-9]/.test(chuTruoc.vi) && /—/.test(chuTruoc.mua) && !/[1-9]/.test(chuTruoc.mua.replace('MÙA 0.0', '')));
    ghi('không thanh cuộn ở cả hai trạng thái', truoc.cuon === 0 && sau.cuon === 0);

    // ── lỗi 500 + thử lại ──
    await ctl('lat=0&loi=1'); await c.go(APP); await chờ("document.querySelector('[data-o=mua]')?.textContent.includes('KHÔNG TẢI')", 30000);
    ghi('lỗi /me/nhiem-vu ⇒ ô Mùa nói KHÔNG TẢI ĐƯỢC + "chạm để thử lại" (không số)', /chạm để thử lại/.test(await c.js("document.querySelector('[data-o=mua]').textContent")));
    const n0 = (await nmock())['GET /me/nhiem-vu'] ?? 0;
    const p = await tam('[data-o=mua]');
    await c.tap(p.x, p.y, 30); await c.tap(p.x, p.y, 30); await c.tap(p.x, p.y, 30); await sleep(1800);
    const dn = ((await nmock())['GET /me/nhiem-vu'] ?? 0) - n0;
    ghi('chạm ô Mùa 3 lần liền khi lỗi ⇒ không bão request (1–2 lượt)', dn >= 1 && dn <= 2, `+${dn}`);
    await ctl('loi=0'); await sleep(2500);                // để lượt retry nội bộ của react-query (nếu còn) xong — chạm khi đang tải thì không có gì để thử lại
    await c.tap(p.x, p.y, 30);
    ghi('API khỏe lại ⇒ chạm thử lại ⇒ ô Mùa hiện số thật', await chờ("document.querySelector('[data-o=mua]')?.textContent.match(/[0-9]\\/[0-9]/)", 8000));

    // ── mất mạng ──
    await ctl('off=1&loi=0'); await c.go(APP); await chờ("document.querySelector('[class*=_dau_]')?.textContent.includes('KHÔNG TẢI')", 40000);
    ghi('mất mạng: đầu sảnh nói rõ + THỬ LẠI; ví "— T"; Hub vẫn đủ ô, không cuộn', /THỬ LẠI/.test(await c.js("document.querySelector('[class*=_dau_]').textContent")) && /— T/.test(await c.js("document.querySelector('[data-o=vi]').textContent")) && (await c.js(DO)).cuon === 0);
    await ctl('off=0');
    const btn = await c.js("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/THỬ LẠI/.test(x.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await c.tap(btn.x, btn.y, 30); await c.tap(btn.x, btn.y, 30);
    ghi('có mạng lại ⇒ THỬ LẠI (bấm đúp) ⇒ ví hiện số thật', await chờ("document.querySelector('[data-o=vi]')?.textContent.match(/[0-9]/)", 15000));
  } finally { await c.dong(); }
}

await new Promise((r) => { apiGia.listen(PORT_API, r); });
try {
  let i = 0;
  for (const [w, h] of KHUNG) { await chayKhung(w, h, 9400 + (i += 1)); }
} finally { apiGia.close(); }
const do_ = bang.filter((b) => !b.ok);
console.log(`\nTỔNG: ${bang.length - do_.length}/${bang.length} PASS${do_.length ? ` · FAIL: ${do_.map((b) => b.ten).join(' | ')}` : ''}`);
process.exit(do_.length ? 1 : 0);
