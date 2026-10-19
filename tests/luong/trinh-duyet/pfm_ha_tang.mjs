/**
 * HẠ TẦNG CHUNG của kịch bản trình duyệt PFM (CDP, không thêm thư viện): API GIẢ + Chrome headless + gieo IndexedDB `delphi_pfm`.
 * Dùng bởi `pfm_bento.mjs` (kịch bản chính) và `pfm_chup.mjs` (ảnh cặp DEMO|APP). Cùng khuôn `hub_bento.mjs` (SPEC mục 5).
 *
 * API là BẢN GIẢ (không DB, không prod): `/auth/me` · `/me/nhiem-vu` · `/pfm/*` · `/holdem/me/*` · telemetry. Mọi tiền của PFM nằm ở
 * IndexedDB của chính trang — script GIEO thẳng vào đó (đúng hình bản ghi `BanGhi<Khoan|Hu|HoSo>` của `web/src/pfm`).
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

export const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

// ─── API GIẢ ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const st = { mode: 'so', lat: 0, off: 0, loi: 0, n: {} };
const giu = [];
const user = (m) => ({
  user_id: 'u1', handle: 'orca_21', age_band: '19_22', region: 'hn', occupation_band: 'sv', bankroll: 1250, role: 'user',
  research_consent: true, created_at: '2026-10-01T00:00:00Z', season_id: 's0', la_khach: m === 'khach',
});
const gui = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

export function dungApiGia(port) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__ctl') {
      for (const [k, v] of u.searchParams) {
        if (k === 'mode') st.mode = v; else if (k === 'reset') st.n = {}; else if (k === 'tha') { while (giu.length) giu.shift()(); } else st[k] = Number(v);
      }
      return gui(res, 200, st);
    }
    if (u.pathname === '/__n') return gui(res, 200, st.n);
    if (u.pathname.startsWith('/api/v1/telemetry')) { res.writeHead(202); return res.end('{"ok":true}'); }
    const khoa = `${req.method} ${u.pathname.replace('/api/v1', '')}`;
    st.n[khoa] = (st.n[khoa] ?? 0) + 1;
    const xong = () => {
      if (st.off) { req.socket.destroy(); return; }
      if (khoa === 'GET /auth/me') {
        if (st.mode === 'chua') return gui(res, 401, { error: 'unauthorized', message: 'x' });
        const pfm = st.mode === 'so' ? { cua: { ket: false, dac_trung: false, thuong: false, noi_game: true }, pfm_consent: true, pfm_bat_dau: '2026-10-01' } : null;
        return gui(res, 200, { email: 'a@b.c', email_verified: true, onboarded: true, user: user(st.mode), pfm, buoi_do: null, hoi_nhan_khau: false });
      }
      if (st.loi) return gui(res, 500, { error: 'server', message: 'Lỗi giả' });
      if (khoa === 'GET /me/nhiem-vu') return gui(res, 200, { mua_mo: true, tuan: 3, so_tuan: 4, chang: 2, so_chang: 30, quest_points: 10, viec: [], da_diem_danh_hom_nay: false, moc: [] });
      if (khoa === 'GET /pfm/tuan') return gui(res, 200, { tuan: '2026-W41', da_niem_phong: false, token: 0 });
      if (khoa === 'POST /pfm/tuan') return gui(res, 200, { ok: true, tuan: '2026-W41', da_niem_phong: true, token: 5 });
      if (khoa === 'GET /holdem/me/nang-luc') return gui(res, 200, { so_de: 0, nang_luc: [] });
      if (khoa === 'GET /holdem/me/tinh-cach') return gui(res, 200, { tinh_cach: 'dang_dinh_hinh', khau_vi: null, net: null, bac_doc: 'chua', n_vong: 0, n_tran: 0, brier_chuoi: [], chi_so: {}, goi: null, tien_do: { tran: 0, vong_quyet: 0, vong_su_kien: 0, can: { tran: 10, vong_quyet: 40, vong_su_kien: 8 }, day: false }, lich_su: [] });
      return gui(res, 404, { error: 'not_found', message: 'x' });
    };
    if (st.lat < 0) giu.push(xong); else setTimeout(xong, st.lat);
  });
  return new Promise((r) => { srv.listen(port, () => r(srv)); });
}
export const ctl = (apiPort, q) => fetch(`http://localhost:${apiPort}/__ctl?${q}`).then((r) => r.json());
export const nmock = (apiPort) => fetch(`http://localhost:${apiPort}/__n`).then((r) => r.json());

// ─── CDP TỐI GIẢN ────────────────────────────────────────────────────────────────────────────────────────────────────
export async function moChrome({ w, h, port, headless = 'new' }) {
  if (!CHROME) throw new Error('Không thấy Chrome — đặt CHROME_PATH');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pfmchrome-'));
  const proc = spawn(CHROME, [`--headless=${headless}`, `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run',
    '--disable-gpu', '--hide-scrollbars', '--disable-extensions', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
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
  // Phỏng vấn coi như đã làm; Oracle gập sẵn (chế độ neo ô giữ sẵn không nhớ "đã mở" nhưng giữ cho chắc).
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('pfm_da_phong_van','1');localStorage.setItem('pfm_da_xem_the','1');localStorage.setItem('delphi.oracle',JSON.stringify({mo:false,cau_da_doc:'x'}))" });
  const c = {
    send,
    async go(url) { await send('Page.navigate', { url }); await sleep(500); },
    async js(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception ?? r.exceptionDetails));
      return r.result.value;
    },
    async mouse(type, x, y) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1 }); },
    async tap(x, y, giuMs = 60) { await c.mouse('mouseMoved', x, y); await c.mouse('mousePressed', x, y); await sleep(giuMs); await c.mouse('mouseReleased', x, y); },
    async phim(key, code, vk) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); },
    async chup(file) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    async dong() {
      try { ws.close(); } catch { /* đã đóng */ }
      if (process.platform === 'win32') {
        const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
        for (let i = 0; i < 3; i += 1) { spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' }); await sleep(700); }
      } else { proc.kill('SIGKILL'); await sleep(800); }
      // XOÁ profile sau mỗi lần chạy (profile Chrome ăn ổ đĩa — bài học 19 lần chụp làm ổ C còn 0 byte).
      for (let i = 0; i < 12; i += 1) { try { fs.rmSync(prof, { recursive: true, force: true }); return; } catch { await sleep(500); } }
      console.error('KHÔNG xoá được profile', prof);
    },
  };
  return c;
}

/** Toạ độ giữa một phần tử (viewport). */
export const tam = (c, sel) => c.js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}})()`);
export async function cham(c, sel, giuMs) { const p = await tam(c, sel); if (!p) throw new Error(`không thấy ${sel}`); await c.tap(p.x, p.y, giuMs); }
export async function cho(c, expr, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await c.js(expr)) return true; } catch { /* trang đang nạp */ } await sleep(200); }
  return false;
}
/** Tua mọi hoạt ảnh HỮU HẠN tới cuối (Chrome headless/khung ẩn có thể đứng đồng hồ hoạt ảnh) — chỉ để ĐO BỐ CỤC. */
export const tuaHoatAnh = (c) => c.js("document.getAnimations().forEach(a=>{try{if(a.effect.getComputedTiming().iterations!==Infinity)a.finish()}catch(e){}}),1");

// ─── GIEO DỮ LIỆU PFM (IndexedDB `delphi_pfm`) ─────────────────────────────────────────────────────────────────────────
const LUC = (n) => `2026-10-${String(n).padStart(2, '0')}T08:00:00.000Z`;

/** Một khoản đúng hình `Khoan` (xem `web/src/pfm/so.ts`). `ngay` dạng `YYYY-MM-DD`. */
export function khoan(id, ngay, soTien, chieu, o = {}) {
  const luc = o.luc ?? `${ngay}T${o.gio ?? '08:00:00'}.000Z`;
  return {
    id, thang: ngay.slice(0, 7), suaLuc: luc,
    d: { id, ngay, soTien, chieu, nhan: null, ...(o.ghiChu ? { ghiChu: o.ghiChu } : {}), huId: o.huId ?? null, cachGhi: 'tay', viSale: null, taoLuc: luc, suaLuc: luc, ...(o.phanBo ? { phanBo: o.phanBo } : {}) },
  };
}
/** Một hũ đúng hình `Hu` (xem `web/src/pfm/hu.ts`). */
export function hu(id, ten, o = {}) {
  const luc = o.luc ?? '2026-09-20T08:00:00.000Z';
  return {
    id, thang: luc.slice(0, 7), suaLuc: luc,
    d: {
      id, ten, muc: o.muc ?? null, mocGop: null, loai: o.loai ?? null, han: null, uuTien: o.sao ? 'cao' : null, thietYeu: null,
      icon: o.icon ?? 'target', trangThai: 'dang_chay', ketQua: null, tuMauId: null, taoLuc: luc, lichSu: [{ ma: 'tao', luc }],
      ...(o.nhom ? { nhom: o.nhom } : {}), ...(o.lenh ? { lenh: o.lenh } : {}), ...(o.loiDoan ? { loiDoan: o.loiDoan } : {}),
    },
  };
}
export const hoSo = (d) => ({ id: 'ho_so', thang: '2026-10', suaLuc: LUC(1), d });

/** Xoá sạch rồi gieo. `ngan` = { khoan: [...], hu: [...], hu_con: [...], meta: [...] }. Trang phải ĐÃ nạp một lần (để app tạo DB). */
export async function gieo(c, ngan) {
  // Chờ APP tự tạo DB (có đủ ngăn) — mở `delphi_pfm` trước khi app mở sẽ tạo một DB RỖNG ở phiên bản 1 và làm hỏng đường nâng cấp.
  for (let i = 0; i < 60; i += 1) {
    const co = await c.js("(async()=>{const l=await indexedDB.databases();return l.some(d=>d.name==='delphi_pfm'&&d.version>=3)})()").catch(() => false);
    if (co) break;
    await sleep(250);
  }
  await c.js(`(async()=>{
    const du=${JSON.stringify(ngan)};
    const db=await new Promise((ok,loi)=>{const r=indexedDB.open('delphi_pfm');r.onsuccess=()=>ok(r.result);r.onerror=()=>loi(r.error);});
    const ten=[...db.objectStoreNames];
    const tx=db.transaction(ten,'readwrite');
    for(const n of ten){tx.objectStore(n).clear();}
    for(const [n,ds] of Object.entries(du)){ if(!ten.includes(n)) continue; for(const b of ds) tx.objectStore(n).put(b); }
    await new Promise((ok,loi)=>{tx.oncomplete=ok;tx.onerror=()=>loi(tx.error);});
    db.close(); return true; })()`);
}
