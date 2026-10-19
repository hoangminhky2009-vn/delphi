/**
 * KỊCH BẢN LUỒNG TRÌNH DUYỆT — BÁO LỖI (SPEC `docs/spec/bao-loi-nguoi-choi.md` mục 5): bấm thật trên Chrome, ENGINE THẬT + Postgres
 * nhúng (`_may_chu_that.mts`), web dev (vite) proxy về máy chủ ấy. In BẢNG PASS/FAIL; thoát 1 nếu có dòng đỏ.
 *
 *   1. THẺ T9 — mở app lần đầu ⇒ thẻ "ĐIỀU KHOẢN VỪA ĐỔI · <ngày>"; bấm "Đã hiểu" ⇒ thẻ đi, cờ "đã xem" nằm trong máy.
 *   2. BÁO LỖI — từ Hub bấm HỒ SƠ (điều hướng TRONG app, không nạp lại trang) → ✉ BÁO LỖI ⇒ dòng "Gửi kèm" ghi bản · màn TRƯỚC Hồ sơ
 *      (`/`) · mã lỗi · mã tài khoản; gõ chữ + email → GỬI ⇒ "Đã gửi."; máy chủ có 1 báo; chuông chỉ ban/man/ma_loi, không chữ, không
 *      email.
 *   3. HẾT LƯỢT — gửi thêm tới lượt thứ tư ⇒ chữ "Hôm nay bạn gửi đủ 3 lượt rồi…", ô GIỮ chữ; máy chủ đúng 3 báo.
 * Ảnh trạm 4: `.local/luong/bao-loi-*.png`.
 *
 * CÁCH CHẠY (một lệnh — tự dựng máy chủ thật + vite, tự dọn):  node tests/luong/trinh-duyet/bao_loi.mjs
 *   biến: LUONG_API_PORT (8797) · LUONG_WEB_PORT (5197) · CHROME_PATH · LUONG_KHUNG ("390x812")
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moChrome, sleep } from './_cdp.mjs';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT_API = Number(process.env.LUONG_API_PORT ?? 8797);
const PORT_WEB = Number(process.env.LUONG_WEB_PORT ?? 5197);
const APP = `http://localhost:${PORT_WEB}/`;
const [W, H] = (process.env.LUONG_KHUNG ?? '390x812').split('x').map(Number);
const ANH = path.join(GOC, '.local/luong');
fs.mkdirSync(ANH, { recursive: true });
const bang = [];
const ghi = (buoc, dat, chiTiet = '') => { bang.push({ buoc, dat, chiTiet }); console.log(`${dat ? 'PASS' : 'FAIL'}  ${buoc}${chiTiet ? ` — ${chiTiet}` : ''}`); };
const dem = () => fetch(`http://localhost:${PORT_API}/__luong/dem`).then((r) => r.json());

/** Chạy một tiến trình con, trả khi một dòng stdout thoả `xong` (hoặc ném sau `han` ms). Cùng nếp `chan_truoc_beta.mjs`. */
function chay(lenh, args, opts, xong, han = 120_000) {
  const p = spawn(lenh, args, { ...opts, shell: process.platform === 'win32' });
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${lenh} ${args.join(' ')}: quá ${han} ms chưa sẵn sàng`)), han);
    let gom = '';
    const doc = (b) => {
      gom += b.toString();
      for (const dong of gom.split('\n')) { const kq = xong(dong); if (kq) { clearTimeout(t); res({ p, kq }); return; } }
    };
    p.stdout.on('data', doc); p.stderr.on('data', (b) => { if (process.env.LUONG_LOG) process.stderr.write(b); });
    p.on('exit', (c) => { clearTimeout(t); rej(new Error(`${lenh} thoát sớm (${c})`)); });
  });
}

/** Dừng mọi tiến trình đang NGHE hai cổng của kịch bản (lý do ở `chan_truoc_beta.mjs`). */
function dungTheoCong(cong) {
  if (process.platform === 'win32') {
    const ps = `Get-NetTCPConnection -LocalPort ${cong.join(',')} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  } else {
    for (const p of cong) spawnSync('sh', ['-c', `fuser -k ${p}/tcp`], { stdio: 'ignore' });
  }
}

async function main() {
  dungTheoCong([PORT_API, PORT_WEB]);
  const api = await chay('npx', ['tsx', 'tests/luong/trinh-duyet/_may_chu_that.mts'], { cwd: GOC, env: { ...process.env, LUONG_API_PORT: String(PORT_API) } },
    (d) => { try { const j = JSON.parse(d); return j.san_sang ? j : null; } catch { return null; } });
  await chay('npx', ['vite', '--port', String(PORT_WEB), '--strictPort'],
    { cwd: path.join(GOC, 'web'), env: { ...process.env, VITE_DEV_API_PROXY: `http://localhost:${PORT_API}` } },
    (d) => /Local:|ready in/.test(d));
  const [ten, gia] = api.kq.cookie.split(';')[0].split('=');
  // Bỏ bàn tập + Oracle đóng sẵn — KHÔNG đặt cờ thẻ điều khoản: thẻ phải tự hiện ở lần mở đầu.
  const c = await moChrome({
    w: W, h: H, port: 9323,
    truoc: "localStorage.setItem('delphi:man-tap:da-qua','bo_qua');localStorage.setItem('delphi.oracle',JSON.stringify({mo:false,cau_da_doc:'',canh:'trai',y:0.95}))",
  });
  const cho = async (bieuThuc, han = 15_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < han) { try { if (await c.js(bieuThuc)) return true; } catch { /* trang đang nạp */ } await sleep(200); }
    return false;
  };
  const bam = (chon) => c.js(`(()=>{const e=document.querySelector(${JSON.stringify(chon)});if(!e)return false;e.click();return true})()`);
  const go = (o, v, kieu) => c.js(`(()=>{const t=document.querySelector('[data-o=${o}]');const set=Object.getOwnPropertyDescriptor(${kieu}.prototype,'value').set;set.call(t,${JSON.stringify(v)});t.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  const CHU = 'Bấm CHỐT VÒNG xong bàn đứng im\nmáy Samsung A52';
  const EMAIL = 'tra.loi@vidu.test';
  try {
    await c.send('Network.setCookie', { name: ten, value: gia, domain: 'localhost', path: '/' });
    await c.go(APP);
    ghi('app dựng xong (vite ấm)', await cho("!!document.querySelector('[data-o=mua]')", 120_000));

    // ── 1. THẺ T9 ──
    ghi('thẻ "Điều khoản vừa đổi" hiện ở lần mở đầu', await cho("!!document.querySelector('[data-the=dieu-khoan-doi]')"),
      await c.js("document.querySelector('[data-the=dieu-khoan-doi]')?.innerText.split('\\n')[0] ?? ''"));
    await c.chup(path.join(ANH, 'bao-loi-1-the.png'));
    await bam('[data-nut=da-hieu]');
    ghi('bấm "Đã hiểu" ⇒ thẻ đi, cờ đã xem nằm trong máy',
      await cho("!document.querySelector('[data-the=dieu-khoan-doi]') && Object.keys(localStorage).some(k=>k.startsWith('delphi.da_xem_the_dieu_khoan.'))"));

    // ── 2. BÁO LỖI (điều hướng trong app: Hub → HỒ SƠ, để "màn trước Hồ sơ" là `/`) ──
    await bam('a[href="/ho-so"]');
    await cho("location.pathname==='/ho-so' && !!document.querySelector('[data-nut=bao-loi]')");
    await bam('[data-nut=bao-loi]');
    await cho("!!document.querySelector('[data-o=noi-dung-bao-loi]')");
    const kem = await c.js("document.querySelector('[data-dong=gui-kem]')?.textContent ?? ''");
    ghi('dòng "Gửi kèm" = bản · màn trước Hồ sơ · mã lỗi · mã tài khoản',
      /^Gửi kèm: bản \d+\.\d+\.\d+ · màn \/ · mã lỗi .+ · mã tài khoản$/.test(kem), kem);
    await go('noi-dung-bao-loi', CHU, 'HTMLTextAreaElement');
    await go('email-bao-loi', EMAIL, 'HTMLInputElement');
    await c.chup(path.join(ANH, 'bao-loi-2-bang.png'));
    await bam('[data-nut=gui-bao-loi]');
    ghi('GỬI ⇒ "Đã gửi."', await cho("document.querySelector('[role=status]')?.textContent?.startsWith('Đã gửi.')"));
    await c.chup(path.join(ANH, 'bao-loi-3-da-gui.png'));
    const d1 = await dem();
    ghi('máy chủ có đúng 1 báo', d1.bao_loi === 1, `bao_loi=${d1.bao_loi}`);
    const ch = d1.chuong.filter((x) => x.ten === 'bao_loi_moi');
    const tin = JSON.stringify(ch);
    ghi('chuông Sentry: 1 lần, chỉ ban/man/ma_loi, không chữ · không email',
      ch.length === 1 && Object.keys(ch[0].nhan).every((k) => ['ban', 'man', 'ma_loi'].includes(k))
        && !tin.includes('Samsung') && !tin.includes('đứng im') && !tin.includes('vidu.test'), tin);

    // ── 3. HẾT LƯỢT ──
    for (let i = 2; i <= 4; i += 1) {
      await go('noi-dung-bao-loi', `lượt ${i}`, 'HTMLTextAreaElement');
      await bam('[data-nut=gui-bao-loi]');
      await cho(i < 4 ? "document.querySelector('[role=status]')?.textContent?.startsWith('Đã gửi.')" : "!!document.querySelector('[role=alert]')");
      await sleep(300);
    }
    const loi = await c.js("document.querySelector('[role=alert]')?.textContent ?? ''");
    ghi('lượt thứ tư ⇒ chữ "hết lượt" của T10', loi === 'Hôm nay bạn gửi đủ 3 lượt rồi. Mai gửi tiếp, hoặc viết email ở cuối trang Điều khoản.', loi);
    ghi('ô GIỮ chữ lượt thứ tư', (await c.js("document.querySelector('[data-o=noi-dung-bao-loi]').value")) === 'lượt 4');
    await c.chup(path.join(ANH, 'bao-loi-4-het-luot.png'));
    const d2 = await dem();
    ghi('máy chủ đúng 3 báo (trần 3/ngày)', d2.bao_loi === 3, `bao_loi=${d2.bao_loi}`);
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
