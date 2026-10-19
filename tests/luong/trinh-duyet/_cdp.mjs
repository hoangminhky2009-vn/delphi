/**
 * CDP TỐI GIẢN dùng chung cho các kịch bản luồng trình duyệt (Chrome headless, không thêm thư viện; Node ≥ 22 có WebSocket sẵn).
 * Tách từ `hub_bento.mjs` (cùng khuôn) để kịch bản Alpha Draft không chép một bản thứ hai (A11.5).
 *
 * ⚠ XOÁ PROFILE sau MỖI lần chạy (`dong()`): profile Chrome ăn ổ đĩa — bài học 19 lần chụp làm ổ C còn 0 byte.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

export const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

/**
 * Mở một Chrome headless ở khung `w×h` (di động, chạm), trả điều khiển.
 * `truoc` = đoạn JS chạy TRƯỚC mọi trang (đặt localStorage…). Mặc định đóng Oracle + qua phỏng vấn PFM.
 */
export async function moChrome({ w, h, port, truoc = '' }) {
  if (!CHROME) throw new Error('Không thấy Chrome — đặt CHROME_PATH');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'adchrome-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu',
    '--hide-scrollbars', '--disable-extensions', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  let info = null;
  for (let i = 0; i < 60 && !info; i += 1) { try { info = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); } }
  if (!info) throw new Error('Chrome không lên');
  const ws = new WebSocket(info.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const cho = new Map(); const sk = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && cho.has(d.id)) { cho.get(d.id)(d); cho.delete(d.id); } else if (d.method) sk.push(d);
  };
  // Hạn 60 s mỗi lệnh: trang đứng hình (vd. rAF bị đóng băng khi cửa sổ headless không được vẽ) thì kịch bản BÁO LỖI chứ không treo im.
  const send = (method, params = {}) => new Promise((res, rej) => {
    id += 1; const i = id;
    const han = setTimeout(() => { cho.delete(i); rej(new Error(`${method}: quá hạn 60 s (trang đứng hình?)`)); }, 60_000);
    cho.set(i, (d) => { clearTimeout(han); return d.error ? rej(new Error(`${method}: ${JSON.stringify(d.error)}`)) : res(d.result); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('pfm_da_phong_van','1');${truoc}` });
  const o = {
    send, sk,
    async go(url) { await send('Page.navigate', { url }); await sleep(400); },
    async js(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception ?? r.exceptionDetails));
      return r.result.value;
    },
    async mouse(type, x, y) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1 }); },
    async tap(x, y, giu = 60) { await o.mouse('mouseMoved', x, y); await o.mouse('mousePressed', x, y); await sleep(giu); await o.mouse('mouseReleased', x, y); },
    async phim(key, code, vk) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
    },
    /** Chụp PNG (toạ độ CSS px × 2) vào `tep`. */
    async chup(tep) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(tep), { recursive: true });
      fs.writeFileSync(tep, Buffer.from(r.data, 'base64'));
    },
    /** Mạng chậm kiểu Slow 3G (trễ ≥ 1,5 s) hoặc tắt hẳn (`offline`); gọi không tham số = trả về bình thường. */
    async mang({ tre = 0, offline = false, xuong = -1, len = -1 } = {}) {
      await send('Network.emulateNetworkConditions', { offline, latency: tre, downloadThroughput: xuong, uploadThroughput: len });
    },
    async dong() {
      try { ws.close(); } catch { /* đã đóng */ }
      if (process.platform === 'win32') {
        const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
        for (let i = 0; i < 3; i += 1) { spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' }); await sleep(700); }
      } else { proc.kill('SIGKILL'); await sleep(800); }
      for (let i = 0; i < 12; i += 1) { try { fs.rmSync(prof, { recursive: true, force: true }); return; } catch { await sleep(500); } }
      console.error('KHÔNG xoá được profile', prof);
    },
  };
  return o;
}
