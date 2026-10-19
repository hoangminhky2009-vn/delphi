/**
 * KỊCH BẢN LUỒNG TRÌNH DUYỆT — CHẶN TRƯỚC BETA (SPEC `docs/spec/chan-truoc-beta.md` mục 5): ba luồng bấm thật trên Chrome, ENGINE THẬT +
 * Postgres nhúng (`_may_chu_that.mts`), web dev (vite) proxy về máy chủ ấy. In BẢNG PASS/FAIL; thoát 1 nếu có dòng đỏ.
 *
 *   1. HUB · Ô TÀI CHÍNH KHOÁ — ô xám có câu "Admin cần donate…", link nhỏ "Bạn có nhu cầu…?" mở lớp trượt; gõ thẳng `/tai-chinh/so`
 *      ⇒ về Hub; không mở kho IndexedDB `delphi_pfm` nào (driver PFM không chạy).
 *   2. BÁO LỖI — Hồ sơ → BÁO LỖI → gõ hai dòng → GỬI ⇒ "Đã gửi"; máy chủ có đúng 1 báo; chuông Sentry kêu 1 lần và KHÔNG chở chữ đã gõ.
 *      Rồi Hồ sơ → DỮ LIỆU CỦA TÔI ⇒ lớp trượt đếm đúng 1 báo lỗi.
 *   3. NỘP VÒNG MẤT MẠNG — bấm CHỐT VÒNG; phản hồi ĐẦU TIÊN bị cắt sau khi máy chủ đã ghi (Fetch domain) + mạng tắt 1,5 s rồi bật ⇒
 *      app tự gửi lại, KHÔNG hiện "vừa được nộp ở nơi khác" / lỗi mạng; máy chủ có đúng 1 dòng vòng + 1 `hd_cam_ket` cho vòng 1.
 *
 * CÁCH CHẠY (một lệnh — tự dựng máy chủ thật + vite, tự dọn):  node tests/luong/trinh-duyet/chan_truoc_beta.mjs
 *   biến: LUONG_API_PORT (8798) · LUONG_WEB_PORT (5198) · CHROME_PATH · LUONG_KHUNG ("390x812")
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moChrome, sleep } from './_cdp.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT_API = Number(process.env.LUONG_API_PORT ?? 8798);
const PORT_WEB = Number(process.env.LUONG_WEB_PORT ?? 5198);
const APP = `http://localhost:${PORT_WEB}/`;
const [W, H] = (process.env.LUONG_KHUNG ?? '390x812').split('x').map(Number);
const bang = [];
const ghi = (buoc, dat, chiTiet = '') => { bang.push({ buoc, dat, chiTiet }); console.log(`${dat ? 'PASS' : 'FAIL'}  ${buoc}${chiTiet ? ` — ${chiTiet}` : ''}`); };
const dem = (q = '') => fetch(`http://localhost:${PORT_API}/__luong/dem${q}`).then((r) => r.json());

/** Chạy một tiến trình con, trả khi một dòng stdout thoả `xong` (hoặc ném sau `han` ms). */
function chay(lenh, args, opts, xong, han = 120_000) {
  const p = spawn(lenh, args, { ...opts, shell: process.platform === 'win32' });
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${lenh} ${args.join(' ')}: quá ${han} ms chưa sẵn sàng`)), han);
    let dem = '';
    const doc = (b) => {
      dem += b.toString();
      for (const dong of dem.split('\n')) { const kq = xong(dong); if (kq) { clearTimeout(t); res({ p, kq }); return; } }
    };
    p.stdout.on('data', doc); p.stderr.on('data', (b) => { if (process.env.LUONG_LOG) process.stderr.write(b); });
    p.on('exit', (c) => { clearTimeout(t); rej(new Error(`${lenh} thoát sớm (${c})`)); });
  });
}

/**
 * Dừng mọi tiến trình đang NGHE hai cổng của kịch bản. `npx` trên Windows bọc node con trong cmd — giết pid của `npx` không giết con
 * (lượt chạy 11/10 để lại máy chủ + vite sống, lượt sau thoát sớm vì cổng bận). Dừng theo cổng là chắc chắn đúng tiến trình mình dựng.
 */
function dungTheoCong(cong) {
  if (process.platform === 'win32') {
    const ps = `Get-NetTCPConnection -LocalPort ${cong.join(',')} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  } else {
    for (const p of cong) spawnSync('sh', ['-c', `fuser -k ${p}/tcp`], { stdio: 'ignore' });
  }
}

async function main() {
  dungTheoCong([PORT_API, PORT_WEB]);   // lượt trước chết giữa chừng thì cổng có thể còn bận
  const api = await chay('npx', ['tsx', 'tests/luong/trinh-duyet/_may_chu_that.mts'], { cwd: GOC, env: { ...process.env, LUONG_API_PORT: String(PORT_API) } },
    (d) => { try { const j = JSON.parse(d); return j.san_sang ? j : null; } catch { return null; } });
  const web = await chay('npx', ['vite', '--port', String(PORT_WEB), '--strictPort'],
    { cwd: path.join(GOC, 'web'), env: { ...process.env, VITE_DEV_API_PROXY: `http://localhost:${PORT_API}` } },
    (d) => /Local:|ready in/.test(d));
  const [ten, gia] = api.kq.cookie.split(';')[0].split('=');
  // Bỏ qua bàn tập + Oracle đóng sẵn (cùng nếp `alpha_draft_bento.mjs`) để kịch bản bấm đúng thứ nó định bấm.
  const c = await moChrome({
    w: W, h: H, port: 9322,
    truoc: "localStorage.setItem('delphi:man-tap:da-qua','bo_qua');localStorage.setItem('delphi.oracle',JSON.stringify({mo:false,cau_da_doc:'',canh:'trai',y:0.95}))",
  });
  const cho = async (bieuThuc, han = 15_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < han) { try { if (await c.js(bieuThuc)) return true; } catch { /* trang đang nạp */ } await sleep(200); }
    return false;
  };
  const bam = (chon) => c.js(`(()=>{const e=document.querySelector(${JSON.stringify(chon)});if(!e)return false;e.click();return true})()`);
  try {
    await c.send('Network.setCookie', { name: ten, value: gia, domain: 'localhost', path: '/' });

    // Khởi động ấm: vite biên dịch + gộp phụ thuộc lần đầu (có thể tự nạp lại trang) — chờ app dựng xong rồi mới đo.
    await c.go(APP);
    ghi('app dựng xong (vite ấm)', await cho("!!document.querySelector('[data-o=mua]')", 120_000));

    // ── 1. HUB · Ô TÀI CHÍNH KHOÁ ──
    await c.go(APP);
    const bn = await c.js("(async()=>{await new Promise(r=>setTimeout(r,4000));const b=document.querySelector('[data-o=arena]');const raf=await new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<500)requestAnimationFrame(f);else r(n)};requestAnimationFrame(f)});return {chu:(b?.innerText??'').slice(0,80),raf}})()");
    // Banner (cửa sổ Hub) cần rAF; Chrome headless có lượt đóng băng vẽ (đo: 4 khung/0,5 s) ⇒ chỉ ghi, không khẳng định ở đây.
    console.log('   (đo) banner:', JSON.stringify(bn));
    await c.chup(path.join(GOC, '.local/luong/chan-truoc-beta-hub.png'));
    ghi('Hub · ô Tài chính giữ icon cũ, mặt ô không chữ khoá', await cho("!!document.querySelector('[data-o=tai-chinh] span[aria-hidden=true]') && !(document.querySelector('[data-o=tai-chinh]')?.textContent??'').includes('donate')"));
    await bam('[data-o=tai-chinh]');
    ghi('Hub · chạm ô ⇒ lớp nói "Admin cần donate…"', await cho("[...document.querySelectorAll('[role=dialog]')].some(d=>d.textContent.includes('Admin cần donate'))"));
    await c.chup(path.join(GOC, '.local/luong/chan-truoc-beta-hub-tam.png'));
    await bam('[data-nut=nhu-cau-pfm]');
    ghi('Hub · link "Bạn có nhu cầu…?" trong lớp ⇒ lớp nhu cầu', await cho("[...document.querySelectorAll('[role=dialog]')].some(d=>d.textContent.includes('Phần hỏi nhanh này chưa mở'))"));
    await c.go(`${APP}tai-chinh/so`);
    ghi('gõ thẳng /tai-chinh/so ⇒ về Hub', await cho("location.pathname==='/'", 40_000), await c.js('location.pathname'));
    const idb = await c.js("indexedDB.databases ? indexedDB.databases().then(d=>d.map(x=>x.name)) : []");
    ghi('không mở kho PFM trên máy (driver không chạy)', !idb.includes('delphi_pfm'), JSON.stringify(idb));

    // ── 2. BÁO LỖI ──
    await c.go(`${APP}ho-so`);
    await cho("!!document.querySelector('[data-nut=bao-loi]')");
    await bam('[data-nut=bao-loi]');
    await cho("!!document.querySelector('[data-o=noi-dung-bao-loi]')");
    const CHU = 'Bấm CHỐT VÒNG xong bàn đứng im\nmáy Samsung A52';
    await c.js(`(()=>{const t=document.querySelector('[data-o=noi-dung-bao-loi]');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(t,${JSON.stringify(CHU)});t.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await bam('[data-nut=gui-bao-loi]');
    ghi('báo lỗi · màn báo "Đã gửi"', await cho("document.body.innerText.includes('Đã gửi')"));
    await c.chup(path.join(GOC, '.local/luong/chan-truoc-beta-bao-loi.png'));
    const d1 = await dem();
    ghi('báo lỗi · máy chủ có đúng 1 báo', d1.bao_loi === 1, `bao_loi=${d1.bao_loi}`);
    ghi('báo lỗi · chuông Sentry kêu 1 lần, không chở chữ đã gõ',
      d1.chuong.length === 1 && !JSON.stringify(d1.chuong).includes('Samsung') && !JSON.stringify(d1.chuong).includes('đứng im'), JSON.stringify(d1.chuong));
    await c.phim('Escape', 'Escape', 27);
    await sleep(600);
    await bam('[data-nut=du-lieu-cua-toi]');
    ghi('Dữ liệu của tôi · đếm đúng 1 báo lỗi', await cho("document.querySelector('[data-tam=du-lieu-cua-toi] [data-so=bao-loi]')?.textContent==='1'"));
    await c.chup(path.join(GOC, '.local/luong/chan-truoc-beta-du-lieu.png'));
    await c.phim('Escape', 'Escape', 27);

    // ── 3. NỘP VÒNG MẤT MẠNG ──
    const t = await c.js("fetch('/api/v1/holdem/matches',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.json())");
    ghi('tạo trận (engine thật)', typeof t.match_id === 'string', t.error ?? '');
    await c.go(`${APP}arena/tran/${t.match_id}`);
    const coNut = await cho("[...document.querySelectorAll('button')].some(b=>/CHỐT VÒNG/.test(b.textContent)&&!b.disabled)", 30_000);
    ghi('bàn đấu · nút CHỐT VÒNG sẵn sàng', coNut);
    // Cắt phản hồi ĐẦU TIÊN của /rounds sau khi máy chủ đã ghi (giai đoạn Response) — đúng ca "server commit, client mất phản hồi".
    await c.send('Fetch.enable', { patterns: [{ urlPattern: '*holdem/matches/*/rounds*', requestStage: 'Response' }] });
    let daCat = 0; let soGui = 0;
    const nghe = setInterval(async () => {
      while (c.sk.length) {
        const ev = c.sk.shift();
        if (ev.method !== 'Fetch.requestPaused') continue;
        soGui += 1;
        if (daCat === 0) {
          daCat = 1;
          // Đúng thứ tự DevTools → Offline: máy mất mạng TRƯỚC (navigator.onLine = false), rồi phản hồi đang bay mới hỏng.
          await c.mang({ offline: true });
          await sleep(100);
          await c.send('Fetch.failRequest', { requestId: ev.params.requestId, errorReason: 'InternetDisconnected' });
          setTimeout(() => { void c.mang(); }, 1500);
        } else {
          await c.send('Fetch.continueRequest', { requestId: ev.params.requestId });
        }
      }
    }, 50);
    await c.js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/CHỐT VÒNG/.test(b.textContent));b&&b.click();return !!b})()");
    const daGuiLai = await cho('true', 1) && await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 25_000) { if (soGui >= 2) return true; await sleep(200); } return false; })();
    await sleep(2500);
    clearInterval(nghe);
    await c.send('Fetch.disable');
    ghi('mất mạng ⇒ app TỰ gửi lại', daGuiLai, `số lần gửi /rounds = ${soGui}`);
    const chu = await c.js('document.body.innerText');
    ghi('không hiện "vừa được nộp ở nơi khác"', !/nơi khác/.test(chu));
    ghi('không kẹt ở băng lỗi mạng', !/Không kết nối được máy chủ|trả lời quá lâu/.test(chu));
    const d2 = await dem(`?match=${t.match_id}`);
    ghi('máy chủ · đúng 1 dòng vòng', d2.dong_vong === 1, `dong_vong=${d2.dong_vong}`);
    ghi('máy chủ · đúng 1 hd_cam_ket cho vòng 1', JSON.stringify(d2.cam_ket) === JSON.stringify([{ vong: '1', n: 1 }]), JSON.stringify(d2.cam_ket));
    await c.chup(path.join(GOC, '.local/luong/chan-truoc-beta-nop-vong.png'));
  } catch (e) {
    ghi('kịch bản chạy hết', false, String(e?.message ?? e));
  } finally {
    await c.dong();
    await fetch(`http://localhost:${PORT_API}/__luong/tat`).catch(() => {});
    await sleep(800);
    dungTheoCong([PORT_API, PORT_WEB]);
  }
  const do_ = bang.filter((x) => !x.dat).length;
  console.log(`\n${bang.length - do_}/${bang.length} PASS${do_ ? ` — ${do_} ĐỎ` : ''}`);
  process.exit(do_ ? 1 : 0);
}

await main();
