/**
 * KỊCH BẢN LUỒNG TRÌNH DUYỆT — CÀI APP ĐỢT 2 (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 5, D603): bấm thật trên Chrome, ENGINE THẬT +
 * Postgres nhúng (`_may_chu_that.mts`), web dev (vite — đường giả lập bản cài `?ban_cai=1` chỉ có ở dev, E10). In BẢNG PASS/FAIL; thoát 1
 * nếu có dòng đỏ. Ảnh ở `.local/luong/cai-app-*.png`.
 *
 *   a. TAB TRÌNH DUYỆT — Hub: chạm ô Tài chính ⇒ lớp "Cài app để mở" ⇒ CÀI APP ⇒ cổng; gõ thẳng `/tai-chinh/so` ⇒ cổng; không kho PFM nào mở.
 *   b. BẢN CÀI (giả lập) — Hub không thẻ nhắc; Tài chính ⇒ phỏng vấn; `/tai-chinh/so` ⇒ bàn tiền.
 *   c. HAI TÀI KHOẢN MỘT MÁY (bản cài) — A ghi 50k ⇒ B đăng nhập thấy sổ trống ⇒ A quay lại thấy đúng 50k của mình.
 *   d. TAI THỎ 47 px (bản cài iOS `black-translucent`) — mọi màn: KHÔNG dòng chữ nào nằm dưới giờ/pin (đo hộp chữ thật).
 *   e. ZALO — băng một dòng trên mọi màn, không chữ nào bị băng che; ✕ ⇒ chấm.
 *   f. Ảnh cổng iPhone · Android · màn đăng nhập có nút CÀI APP.
 *
 * CÁCH CHẠY (một lệnh — tự dựng máy chủ thật + vite, tự dọn):  node tests/luong/trinh-duyet/cai_app.mjs
 *   biến: LUONG_API_PORT (8797) · LUONG_WEB_PORT (5197) · CHROME_PATH · LUONG_KHUNG ("390x844")
 *   TIÊM NGƯỢC phép đo §d (QC bố cục 11/10 — script đo từng báo 0 lỗi cả bản hỏng): LUONG_TIEM=an_tren ép `--an-tren: 0` (màn không chừa
 *   tai thỏ) ⇒ §d PHẢI đỏ. Đo 12/10: đỏ trên 19/19 màn.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moChrome, sleep } from './_cdp.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT_API = Number(process.env.LUONG_API_PORT ?? 8797);
const PORT_WEB = Number(process.env.LUONG_WEB_PORT ?? 5197);
const APP = `http://localhost:${PORT_WEB}/`;
const [W, H] = (process.env.LUONG_KHUNG ?? '390x844').split('x').map(Number);
const TAI_THO = 47;
const ANH = (ten) => path.join(GOC, `.local/luong/cai-app-${ten}.png`);
const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  zalo: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Zalo android/12100626 ZaloTheme/light ZaloLanguage/vn',
};
const bang = [];
const ghi = (buoc, dat, chiTiet = '') => { bang.push({ buoc, dat, chiTiet }); console.log(`${dat ? 'PASS' : 'FAIL'}  ${buoc}${chiTiet ? ` — ${chiTiet}` : ''}`); };

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
function dungTheoCong(cong) {
  if (process.platform === 'win32') {
    const ps = `Get-NetTCPConnection -LocalPort ${cong.join(',')} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  } else {
    for (const p of cong) spawnSync('sh', ['-c', `fuser -k ${p}/tcp`], { stdio: 'ignore' });
  }
}

/** Tai thỏ GIẢ: đặt `--tai-tho` (đúng biến mọi màn đọc) + vẽ dải đỏ mờ "9:41" để ảnh nhìn ra vùng giờ/pin. */
const GIA_TAI_THO = `(()=>{if(document.querySelector('[data-gia-tai-tho]'))return 1;const s=document.createElement('style');s.textContent=':root{--tai-tho:${TAI_THO}px!important}${process.env.LUONG_TIEM === 'an_tren' ? ':root{--an-tren:0px!important}' : ''}';document.head.appendChild(s);
  const d=document.createElement('div');d.dataset.giaTaiTho='';d.textContent='9:41';d.style.cssText='position:fixed;top:0;left:0;right:0;height:${TAI_THO}px;background:rgba(255,40,40,.28);z-index:2147483647;pointer-events:none;color:#fff;font:600 15px system-ui;display:flex;align-items:center;padding-left:28px';document.body.appendChild(d);return 1})()`;
/** Mọi hộp CHỮ thật đang thấy có phần nằm trong dải [0, tren) — trừ vùng `bo`. */
const CHU_DUOI = (tren, bo = '[data-gia-tai-tho]') => `(()=>{const ra=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const t=n.textContent.trim();if(!t)continue;const el=n.parentElement;if(!el||el.closest(${JSON.stringify(bo)}))continue;
  let a=el,an=false;while(a){const cs=getComputedStyle(a);if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0){an=true;break}a=a.parentElement}if(an)continue;
  const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects()){if(b.width>0&&b.height>0&&b.top<${tren}&&b.bottom>0&&b.right>0&&b.left<innerWidth){ra.push(t.slice(0,24)+'@'+Math.round(b.top));break}}}return ra})()`;

async function main() {
  dungTheoCong([PORT_API, PORT_WEB]);
  const api = await chay('npx', ['tsx', 'tests/luong/trinh-duyet/_may_chu_that.mts'], { cwd: GOC, env: { ...process.env, LUONG_API_PORT: String(PORT_API) } },
    (d) => { try { const j = JSON.parse(d); return j.san_sang ? j : null; } catch { return null; } });
  const web = await chay('npx', ['vite', '--port', String(PORT_WEB), '--strictPort'],
    { cwd: path.join(GOC, 'web'), env: { ...process.env, VITE_DEV_API_PROXY: `http://localhost:${PORT_API}` } },
    (d) => /Local:|ready in/.test(d));
  void web;
  const cookieA = api.kq.cookie.split(';')[0];
  const c = await moChrome({
    w: W, h: H, port: 9324,
    truoc: "localStorage.setItem('delphi:man-tap:da-qua','bo_qua');localStorage.setItem('delphi.oracle',JSON.stringify({mo:false,cau_da_doc:'',canh:'trai',y:0.95}));localStorage.setItem('delphi.da_xem_the_dieu_khoan.'+'12/10/2026',new Date().toISOString())",
  });
  const cho = async (bieuThuc, han = 15_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < han) { try { if (await c.js(bieuThuc)) return true; } catch { /* trang đang nạp */ } await sleep(200); }
    return false;
  };
  const bam = (chon) => c.js(`(()=>{const e=document.querySelector(${JSON.stringify(chon)});if(!e)return false;e.click();return true})()`);
  const datCookie = async (ck) => {
    await c.send('Network.deleteCookies', { name: ck.split('=')[0], domain: 'localhost' });
    const [ten, ...gia] = ck.split('=');
    await c.send('Network.setCookie', { name: ten, value: gia.join('='), domain: 'localhost', path: '/' });
  };
  /*
   * Đổi UA rồi đi qua about:blank: lượt điều hướng NGAY sau `setUserAgentOverride` có lúc vẫn chạy UA cũ (đo 12/10: 2/3 lượt chạy đỏ
   * đúng bước đầu sau đổi UA — iPhone rồi Zalo — còn bước sau cùng UA thì xanh).
   */
  const doiUA = async (ua) => { await c.send('Emulation.setUserAgentOverride', { userAgent: ua }); await c.go('about:blank'); await sleep(300); };
  const tenKhoPfm = () => c.js("indexedDB.databases ? indexedDB.databases().then(d=>d.map(x=>x.name).filter(n=>n.startsWith('delphi_pfm'))) : []");
  const soHomNay = () => c.js("document.querySelector('[data-o=so-hom-nay] [data-testid=so-hom-nay]')?.dataset.dayDu ?? null");
  try {
    await datCookie(cookieA);
    await c.go(APP);
    ghi('app dựng xong (vite ấm)', await cho("!!document.querySelector('[data-o=mua]')", 120_000));

    // ── a. TAB TRÌNH DUYỆT ──
    await c.go(`${APP}?ban_cai=0`);
    await cho("!!document.querySelector('[data-o=tai-chinh]')");
    await sleep(1500);
    ghi('a · Hub tab: có thẻ nhắc "Cài app để lưu dữ liệu lâu hơn"', await cho("!!document.querySelector('[data-o=the-cai-app]')", 5000));
    ghi('a · ⭐ MẶT ô Tài chính ghi "Cài app để mở", nằm trong ô, không đè chữ xem trước', await c.js(`(()=>{const o=document.querySelector('[data-o=tai-chinh]');const k=o&&o.querySelector('[data-o=tai-chinh-cai-de-mo]');if(!k||!/Cài app để mở/i.test(k.textContent))return false;
      const a=o.getBoundingClientRect(),b=k.getBoundingClientRect();if(b.top<a.top||b.bottom>a.bottom)return false;
      return [...o.querySelectorAll('[data-xem-truoc-pfm] *')].filter(e=>e.children.length===0&&e.textContent.trim()&&getComputedStyle(e).opacity!=='0').every(e=>{const r=e.getBoundingClientRect();return r.height===0||r.bottom<=b.top||r.top>=b.bottom})})()`));
    await c.chup(ANH('a-hub-tab'));
    await bam('[data-o=tai-chinh]');
    ghi('a · chạm ô Tài chính ⇒ lớp "Cài app để mở" (hết câu donate)', await cho("[...document.querySelectorAll('[role=dialog]')].some(d=>d.textContent.includes('Cài app để mở')&&!/donate/i.test(d.textContent))"));
    await sleep(600);
    await c.chup(ANH('a-hub-lop'));
    await bam('[role=dialog] [data-o=cai-app]');
    ghi('a · nút CÀI APP ⇒ /cai-app?noi=cong_pfm', await cho("location.pathname==='/cai-app'&&location.search==='?noi=cong_pfm'", 8000), await c.js('location.pathname+location.search'));
    await c.go(`${APP}tai-chinh/so`);
    ghi('a · gõ thẳng /tai-chinh/so ⇒ cổng cài', await cho("location.pathname==='/cai-app'", 20_000), await c.js('location.pathname'));
    ghi('a · không kho PFM nào mở trên tab (driver nền không chạy)', (await tenKhoPfm()).length === 0, JSON.stringify(await tenKhoPfm()));

    // ── b. BẢN CÀI (giả lập dev) ──
    await c.go(`${APP}?ban_cai=1`);
    await cho("!!document.querySelector('[data-o=tai-chinh]')");
    await sleep(1500);
    ghi('b · bản cài: Hub KHÔNG thẻ nhắc cài', !(await c.js("!!document.querySelector('[data-o=the-cai-app]')")));
    await bam('[data-o=tai-chinh]');
    await cho("!!document.querySelector('[role=dialog]')");
    await sleep(700);
    const coMo = await c.js("(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>/TÀI CHÍNH/.test(x.textContent)&&/▸/.test(x.textContent));if(!b)return false;b.click();return true})()");
    ghi('b · lớp Tài chính có nút vào khu (không nút cài)', coMo === true && !(await c.js("!!document.querySelector('[role=dialog] [data-o=cai-app]')")));
    ghi('b · Tài chính ⇒ PHỎNG VẤN (cổng đứng trước phỏng vấn, không chặn nó)', await cho("document.body.innerText.includes('CHẠM LÀ XONG')", 20_000), await c.js('location.pathname'));
    await c.chup(ANH('b-phong-van'));
    await c.go(`${APP}tai-chinh/so`);
    ghi('b · /tai-chinh/so ⇒ bàn tiền (sổ mở trong bản cài)', await cho("!!document.querySelector('[data-testid=ban-tien]')", 20_000), await c.js('location.pathname'));

    // ── c. HAI TÀI KHOẢN MỘT MÁY ──
    await sleep(1500);
    const to = await c.js(`(()=>{const b=[...document.querySelectorAll('[data-testid="ban-tien"] button')].find(x=>x.textContent.trim()==='50k');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await c.tap(to.x, to.y, 40); await sleep(500);
    const chi = await c.js(`(()=>{const b=[...document.querySelectorAll('[data-testid="ban-tien"] button')].find(x=>/CHI/.test(x.textContent)&&!/THU/.test(x.textContent));const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await c.tap(chi.x, chi.y, 30); await sleep(1500);
    const a1 = await soHomNay();
    ghi('c · A ghi 50k ⇒ CHI HÔM NAY của A = 50.000', a1 === '50.000', String(a1));
    const khoA = await tenKhoPfm();
    const b = await (await fetch(`http://localhost:${PORT_API}/__luong/nguoi-moi`)).json();
    await datCookie(b.cookie.split(';')[0]);
    await c.go(`${APP}tai-chinh/so`);
    await cho("!!document.querySelector('[data-testid=ban-tien]')", 20_000); await sleep(1500);
    const b1 = await soHomNay();
    ghi('c · ⭐ B đăng nhập cùng máy ⇒ sổ B KHÔNG có khoản của A', b1 !== null && b1 !== '50.000', String(b1));
    const khoAB = await tenKhoPfm();
    ghi('c · mỗi tài khoản một kho riêng (delphi_pfm_<user_id>)', khoA.length === 1 && khoAB.length === 2 && khoAB.every((n) => /^delphi_pfm_./.test(n)), JSON.stringify(khoAB));
    await c.chup(ANH('c-so-b'));
    await datCookie(cookieA);
    await c.go(`${APP}tai-chinh/so`);
    await cho("!!document.querySelector('[data-testid=ban-tien]')", 20_000); await sleep(1500);
    const a2 = await soHomNay();
    ghi('c · A quay lại ⇒ thấy đúng 50k của A', a2 === '50.000', String(a2));

    // ── d. TAI THỎ 47 px trên mọi màn (bản cài) ──
    const tran = await c.js("fetch('/api/v1/holdem/matches',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.json())");
    const MAN = ['', 'arena', 'arena/huong-dan', 'ho-so', 'ho-so/the', 'vi', 'shop', 'hanh-trinh', 'cai-dat', 'du-bao', 'bach-khoa', 'dieu-khoan', 'cai-app',
      'tai-chinh/so', 'tai-chinh/hu', 'tai-chinh/guong', 'tai-chinh/the', 'tai-chinh/phong-van', ...(tran.match_id ? [`arena/tran/${tran.match_id}`] : [])];
    const loiTai = [];
    for (const m of MAN) {
      await c.go(`${APP}${m}`);
      await sleep(m.startsWith('arena/tran') ? 6000 : 3500);
      await c.js(GIA_TAI_THO); await sleep(500);
      const duoi = await c.js(CHU_DUOI(TAI_THO));
      if (duoi.length) loiTai.push(`/${m}: ${duoi.slice(0, 3).join(' | ')}`);
      if (['', 'tai-chinh/so', 'cai-dat', 'ho-so'].includes(m) || m.startsWith('arena/tran')) await c.chup(ANH(`d-tai-tho-${(m || 'hub').replace(/\//g, '-').slice(0, 24)}`));
    }
    ghi(`d · ⭐ tai thỏ ${TAI_THO} px: 0 dòng chữ dưới giờ/pin trên ${MAN.length} màn`, loiTai.length === 0, loiTai.join(' ;; '));
    await c.send('Network.deleteCookies', { name: cookieA.split('=')[0], domain: 'localhost' });
    await c.go(`${APP}onboard`); await sleep(3500);
    await c.js(GIA_TAI_THO); await sleep(400);
    const duoiDn = await c.js(CHU_DUOI(TAI_THO));
    ghi('d · tai thỏ: màn đăng nhập (bản cài — không nút CÀI APP) 0 chữ dưới giờ/pin', duoiDn.length === 0 && !(await c.js("!!document.querySelector('[data-nut=cai-app]')")), duoiDn.join(' | '));
    await c.chup(ANH('d-tai-tho-dang-nhap'));

    // ── f. CỔNG + MÀN ĐĂNG NHẬP trên tab (ảnh) ──
    // Gỡ giả lập bản cài THẲNG trong sessionStorage: `/?ban_cai=0` lúc chưa đăng nhập bị đá về `/onboard` trước khi app kịp đọc tham số
    // (đo 12/10: một lượt e/f đỏ vì tab vẫn "bản cài").
    await c.js("sessionStorage.removeItem('delphi:ban_cai_gia')");
    await doiUA(UA.android);
    await c.go(`${APP}onboard`);
    ghi('f · tab Android: màn đăng nhập có nút CÀI APP', await cho("!!document.querySelector('[data-nut=cai-app]')", 10_000));
    await c.chup(ANH('f-dang-nhap-android'));
    await datCookie(cookieA);
    await c.go(`${APP}cai-app?noi=dang_nhap`);
    ghi('f · cổng Android (chưa có lời mời ở headless) ⇒ hướng dẫn menu', await cho("!!document.querySelector('[data-o=qua-menu]')", 10_000));
    await c.chup(ANH('f-cong-android'));
    await doiUA(UA.ios);
    await c.go(`${APP}cai-app?noi=cong_pfm`);
    ghi('f · cổng iPhone ⇒ ba bước có hình + dòng "Đã cài rồi?"', await cho("document.querySelectorAll('[data-o=ba-buoc-ios] li').length===3&&!!document.querySelector('[data-o=da-cai-ios]')", 10_000));
    await c.chup(ANH('f-cong-ios'));

    // ── e. ZALO: băng mọi màn ──
    await doiUA(UA.zalo);
    const loiBang = [];
    for (const m of ['', 'ho-so', 'arena', 'cai-dat', 'cai-app']) {
      await c.go(`${APP}${m}`);
      const co = await cho("!!document.querySelector('[data-o=bang-nhung]')", 10_000);
      await sleep(1500);
      const duoi = await c.js(CHU_DUOI(32, '[data-o=bang-nhung]'));
      if (!co || duoi.length) loiBang.push(`/${m}: băng=${co} ua=${(await c.js('navigator.userAgent')).slice(-30)} ${duoi.slice(0, 3).join(' | ')}`);
      if (m === '' || m === 'cai-app') await c.chup(ANH(`e-zalo-${m || 'hub'}`));
    }
    ghi('e · ⭐ Zalo: băng ở mọi màn, không chữ nào bị băng che', loiBang.length === 0, loiBang.join(' ;; '));
    await bam('[data-nut=thu-bang-nhung]');
    ghi('e · ✕ ⇒ băng thu thành chấm', await cho("!document.querySelector('[data-o=bang-nhung]')&&!!document.querySelector('[data-o=cham-bang-nhung]')", 3000));
    await c.go(`${APP}ho-so`); await sleep(2500);
    ghi('e · đổi màn cùng phiên ⇒ vẫn là chấm', await c.js("!document.querySelector('[data-o=bang-nhung]')&&!!document.querySelector('[data-o=cham-bang-nhung]')"));
    await c.chup(ANH('e-zalo-cham'));
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
