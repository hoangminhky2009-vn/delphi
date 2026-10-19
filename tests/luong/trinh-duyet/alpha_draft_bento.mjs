/**
 * KỊCH BẢN LUỒNG TRÌNH DUYỆT — ALPHA DRAFT BENTO: SẢNH + MÀN KẾT (+ Hub: Oracle không che nút).
 * SPEC `docs/spec/alpha-draft-tang-khong-gian.md` mục 5 + 5b (founder 11/10: *"giống demo … tính cả trễ mạng … kiểm tra thật kỹ chuyển tiếp và đường dẫn"*).
 *
 * Bấm thật trên Chrome (CDP, không thêm thư viện), API GIẢ (`_api_gia_alpha.mjs`; không DB, không prod). Chạy ở 390×812 và 360×640. In từng dòng PASS/FAIL
 * và BẢNG 5b.3 (mọi nút/ô/cử chỉ → đích) cuối cùng; thoát 1 nếu có dòng đỏ.
 *
 * Phủ:
 *   · KHÔNG CUỘN (scrollHeight − clientHeight = 0) ở mọi trạng thái sảnh (chưa vào · trận dở · hôm nay xong · sau màn tập · tải · lỗi) và màn kết (hạng 3 · hạng 1 · cháy · thiếu phong cách);
 *   · ORACLE: toạ độ — head ∩ MỌI nút/ô bấm = rỗng ở Hub và sảnh (chưa bung); head nằm đúng ô giữ sẵn; màn kết không có Oracle;
 *   · bấm TỪNG ô/nút → đích; lớp trượt đóng bằng nền · Esc · vuốt; focus trả về; Back/Forward; deep link (khách · chưa đăng nhập · link mời · mã sai);
 *   · mạng chậm (Slow 3G ≥ 1,5 s): chỗ giữ sẵn không nhảy (toạ độ trước/sau), không số 0 giả; lỗi có chữ + THỬ LẠI; bấm đúp không gửi trùng; mất mạng;
 *   · phản hồi chạm: lún ≤ 50 ms (ô), hạt pixel (nút chính), `prefers-reduced-motion` tắt đúng chỗ.
 *
 * CÁCH CHẠY (hai cửa sổ dòng lệnh):
 *   1)  cd web && VITE_DEV_API_PROXY=http://localhost:8799 npx vite --port 5199 --strictPort
 *   2)  node tests/luong/trinh-duyet/alpha_draft_bento.mjs        (biến: HUB_URL · HUB_API_PORT · CHROME_PATH · ADB_KHUNG="390x812,360x640" · ANH_DIR=thư mục ảnh)
 */
import fs from 'node:fs';
import path from 'node:path';
import { moChrome, sleep } from './_cdp.mjs';
import { ctl as ctl0, khoiDongApi, nmock as nmock0 } from './_api_gia_alpha.mjs';

const APP = process.env.HUB_URL ?? 'http://localhost:5199/';
const PORT_API = Number(process.env.HUB_API_PORT ?? 8799);
const KHUNG = (process.env.ADB_KHUNG ?? '390x812,360x640').split(',').map((k) => k.split('x').map(Number));
const ANH = process.env.ANH_DIR ?? null;
/** ADB_SEC=A,B,... chạy từng PHẦN (mỗi phần dưới ~8 phút — một lệnh chạy tay có hạn 10 phút). A: Hub+sảnh · B: trạng thái ô chính · C: deep link · D: mạng chậm/lỗi · E: màn kết · F: kết chậm/lỗi/giảm chuyển động. Mặc định: tất cả. */
const SEC = process.env.ADB_SEC ? new Set(process.env.ADB_SEC.split(',')) : null;
const sec = (n) => SEC === null || SEC.has(n);
const ctl = (q) => ctl0(PORT_API, q);
const nmock = () => nmock0(PORT_API);
const TRUOC = "if(!localStorage.getItem('delphi:man-tap:da-qua'))localStorage.setItem('delphi:man-tap:da-qua','bo_qua');if(!localStorage.getItem('delphi.oracle'))localStorage.setItem('delphi.oracle',JSON.stringify({mo:true,cau_da_doc:'',canh:'trai',y:0.95}))";

const bang = [];
const b53 = [];
const ghi = (ten, ok, ct = '') => {
  bang.push({ ten, ok });
  const dong1 = `${ok ? 'PASS' : 'FAIL'}  ${ten}${ct ? `  — ${ct}` : ''}`;
  console.log(dong1);
  // Chạy nền thì stdout của Node trên Windows có thể bị giữ tới khi thoát — ADB_LOG ghi từng dòng NGAY ra tệp để theo dõi tiến độ.
  if (process.env.ADB_LOG) fs.appendFileSync(process.env.ADB_LOG, `${dong1}
`);
};
/** Một dòng của BẢNG 5b.3: [cử chỉ] → [đích mong đợi] ⇒ kết quả. */
const dong = (khung, tu, cuChi, dich, ok, ct = '') => { b53.push({ khung, tu, cuChi, dich, ok, ct }); ghi(`[${tu}] ${cuChi} → ${dich}`, ok, ct); };

const DO_CUON = '(()=>{const d=document.documentElement;const a=d.scrollHeight-d.clientHeight;window.scrollTo(0,400);const y=window.scrollY;window.scrollTo(0,0);return {thua:a,y}})()';
/** head Oracle ∩ MỌI nút/ô bấm nhìn thấy (trừ chính nó) — rỗng thì `dung` = []. */
const DO_CHONG = `(()=>{const h=document.querySelector('[data-testid=oracle-head]');if(!h)return {co:false};const a=h.getBoundingClientRect();
 const cho=document.querySelector('[data-oracle-cho]');const c=cho?cho.getBoundingClientRect():null;
 const ds=[...document.querySelectorAll('button,a[href],[data-o],[role=button],input')].filter((e)=>e!==h&&!h.contains(e));
 const dung=[];for(const e of ds){const b=e.getBoundingClientRect();if(b.width===0||b.height===0)continue;const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||s.display==='contents')continue;
 const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left),oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
 if(ox>0.5&&oy>0.5)dung.push((e.getAttribute('data-o')||e.getAttribute('aria-label')||e.textContent.trim().slice(0,18))+':'+Math.round(ox)+'x'+Math.round(oy));}
 return {co:true,x:a.x,y:a.y,w:a.width,h:a.height,dung,cho:c?{x:c.x,y:c.y,w:c.width,h:c.height}:null,trongMan:a.left>=0&&a.top>=0&&a.right<=innerWidth&&a.bottom<=innerHeight};})()`;
const KHOI_SANH = ['chinh', 'may', 'xep', 'ru', 'man-tap', 'bach-khoa'];
const DO_KHOI = (ds) => `(()=>{const o={};for(const k of ${JSON.stringify(ds)}){const e=document.querySelector('[data-o="'+k+'"]');if(!e){o[k]=null;continue;}const b=e.getBoundingClientRect();o[k]=[Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)];}return o;})()`;

async function chayKhung(w, h, port) {
  const c = await moChrome({ w, h, port, truoc: TRUOC });
  const tenKhung = `${w}x${h}`;
  const cho = async (expr, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await c.js(`!!(${expr})`)) return true; } catch { /* trang đang nạp */ } await sleep(200); } return false; };
  const tam = (sel) => c.js(`(()=>{const e=document.querySelector('${sel}');if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  const cham = async (sel, giu) => { const p = await tam(sel); if (!p) throw new Error(`không thấy ${sel}`); await c.tap(p.x, p.y, giu); };
  /** Chạm nút CÓ CHỮ khớp `re` trong vùng `scope` (phòng chờ bàn ngày có nút CHIA SẺ đứng trước HUỶ — không chạm theo thứ tự). */
  const chamChu = async (scope, re) => {
    const p = await c.js(`(()=>{const b=[...document.querySelectorAll('${scope} button')].find(x=>/${re}/.test(x.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    if (!p) throw new Error(`không thấy nút ${re} trong ${scope}`);
    await c.tap(p.x, p.y, 40);
  };
  const duong = () => c.js('location.pathname');
  const lop = () => c.js("(()=>{const d=document.querySelector('[role=dialog][data-tam]');return d?d.textContent:null})()");
  const choLop = async () => { await cho("document.querySelector('[role=dialog][data-tam]')", 4000); await sleep(450); };
  const choKhongLop = (ms = 3000) => cho("!document.querySelector('[role=dialog][data-tam]')", ms);
  const nutTrongLop = (re) => c.js(`(()=>{const b=[...document.querySelectorAll('[role=dialog][data-tam] button')].find(x=>/${re}/.test(x.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const anh = async (ten) => { if (ANH) await c.chup(path.join(ANH, `${tenKhung}-${ten}.png`)); };
  const moSanh = async (q = '', url = `${APP}arena`) => {
    await ctl(`mode=so&lat=0&off=0&loi=0&loiAutopsy=0&reset=1&ngay=chua&dang=0&${q}`);
    await c.go(url);
    await cho("document.querySelector('[data-o=may]')", 40000);
    await cho("document.querySelector('[data-chinh]') && document.querySelector('[data-chinh]').dataset.trangThai !== 'doc'", 40000);
    await cho("document.querySelector('[data-testid=oracle-head]')", 15000); // lời Oracle về chậm hơn sảnh — đo chồng lấn khi head ĐÃ có mặt
    await sleep(400);
  };
  const cuon = async () => { const r = await c.js(DO_CUON); return r.thua === 0 && r.y === 0; };
  console.log(`\n=== KHUNG ${tenKhung} ===`);
  try {
    if (sec('A')) {
    // ───────────────────────── HUB: Oracle không che nút ─────────────────────────
    await ctl('mode=so&reset=1');
    await c.go(APP);
    await cho("document.querySelector('[data-o=mua]')?.textContent.match(/[0-9]/) && document.querySelector('[data-testid=oracle-head]')", 40000); await sleep(900);
    const hub = await c.js(DO_CHONG);
    ghi('Hub: không thanh cuộn', await cuon());
    ghi('⭐ Hub: Oracle head ∩ MỌI nút/ô bấm = rỗng (kể cả VÀO TRẬN), head NẰM TRONG màn', hub.co && hub.dung.length === 0 && hub.trongMan, JSON.stringify(hub.dung));
    ghi('Hub: head đúng ô giữ sẵn (±1 px) và KHÔNG tự bung dù máy nhớ mo=true', hub.cho && Math.abs(hub.x - hub.cho.x) <= 1 && Math.abs(hub.y - hub.cho.y) <= 1 && !(await c.js("!!document.querySelector('[data-testid=oracle-chat]')")));
    await anh('hub-oracle');
    await cham('[data-testid=oracle-head]'); await sleep(500);
    ghi('Hub: chạm head ⇒ bung lời XUỐNG dưới ô giữ sẵn', await c.js("(()=>{const b=document.querySelector('[data-testid=oracle-chat]'),h=document.querySelector('[data-testid=oracle-head]');if(!b)return false;return b.getBoundingClientRect().top>=h.getBoundingClientRect().bottom})()"));
    await anh('hub-oracle-bung');
    await c.tap(w / 2, h - 120, 40); await sleep(400);
    ghi('Hub: chạm ra ngoài ⇒ lời gập', !(await c.js("!!document.querySelector('[data-testid=oracle-chat]')")));

    // ───────────────────────── SẢNH ─────────────────────────
    await moSanh();
    ghi('SẢNH thường (chưa vào): không thanh cuộn (scrollHeight − clientHeight = 0, kéo thử cũng đứng yên)', await cuon());
    const k0 = await c.js(DO_KHOI(KHOI_SANH));
    ghi('SẢNH: đủ ô chính + 4 ô chế độ + nút sách, tất cả nằm TRONG màn (không tràn đáy)', KHOI_SANH.every((k) => k0[k] && k0[k][1] >= 0 && k0[k][1] + k0[k][3] <= h), JSON.stringify(k0));
    const sc = await c.js(DO_CHONG);
    ghi('⭐ SẢNH: Oracle head ∩ MỌI nút/ô bấm (kể cả VÀO BÀN HÔM NAY, nút sách, BottomNav) = rỗng', sc.co && sc.dung.length === 0 && sc.trongMan, JSON.stringify(sc.dung));
    ghi('SẢNH: head đúng ô giữ sẵn, không tự bung', sc.cho && Math.abs(sc.x - sc.cho.x) <= 1 && Math.abs(sc.y - sc.cho.y) <= 1 && !(await c.js("!!document.querySelector('[data-testid=oracle-chat]')")));
    const chu = await c.js('document.body.innerText');
    ghi('SẢNH: mặt màn KHÔNG chứa mô tả dài / khẩu vị (chỉ nhãn · tên · một dòng phụ)', !/thử chiến thuật thoải mái|ít nhất 4 người chơi thật|không cần online cùng lúc|KHẨU VỊ/i.test(chu));
    ghi('SẢNH: ô XẾP HẠNG ghi "cần ≥ 4 người thật"', /cần ≥ 4 người thật/.test(await c.js("document.querySelector('[data-o=xep]').textContent")));
    await anh('sanh-thuong');

    // phản hồi chạm
    const lunMs = await c.js("(async()=>{const e=document.querySelector('[data-o=may]');const t0=performance.now();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true,button:0}));await new Promise((r)=>queueMicrotask(r));await new Promise((r)=>setTimeout(r,16));const lun=/lun/.test(e.className);const tr=getComputedStyle(e).transform;const dt=performance.now()-t0;e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));return {lun,tr,dt}})()");
    ghi('phản hồi chạm: nhấn xuống ⇒ ô LÚN trong khung hình kế (≤ 50 ms kể cả chờ vẽ), dịch 3 px', lunMs.lun && lunMs.dt <= 50 && /matrix\(1, 0, 0, 1, 3, 3\)/.test(lunMs.tr), JSON.stringify(lunMs));
    await sleep(500);

    // 5b.3 — từng ô → đích
    for (const [dau, re, ten] of [['may', 'thử chiến thuật thoải mái', 'ĐẤU VỚI MÁY'], ['xep', 'ít nhất 4 người chơi thật', 'XẾP HẠNG'], ['ru', 'không cần online cùng lúc', 'RỦ BẠN']]) {
      await c.js(`document.querySelector('[data-o=${dau}]').focus()`);
      await cham(`[data-o=${dau}]`); await choLop();
      const t = await lop();
      dong(tenKhung, 'sảnh', `chạm ô ${ten}`, 'lớp trượt có mô tả đúng', !!t && new RegExp(re, 'i').test(t));
      if (dau === 'may') await anh('sanh-lop-may');
      if (dau === 'xep') { await anh('sanh-lop-xep'); ghi('XẾP HẠNG: lớp nói số máy luôn ít hơn số người', /số máy luôn ít hơn số người/.test(t ?? '')); }
      if (dau === 'ru') await anh('sanh-lop-ru');
      ghi('lớp trượt: KHÔNG làm trang cuộn / đẩy ô nào phía sau', await cuon());
      await c.phim('Escape', 'Escape', 27);
      ghi(`Esc đóng lớp ${ten} + FOCUS về đúng ô`, (await choKhongLop()) && (await c.js("document.activeElement?.getAttribute('data-o')")) === dau);
    }
    await cham('[data-o=may]'); await choLop(); await c.tap(w / 2, 24, 40);
    ghi('chạm NỀN tối ⇒ đóng lớp', await choKhongLop());
    await cham('[data-o=may]'); await choLop();
    const q = await c.js("(()=>{const b=document.querySelector('[role=dialog]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+10}})()");
    await c.mouse('mouseMoved', q.x, q.y); await c.mouse('mousePressed', q.x, q.y);
    for (let i = 1; i <= 8; i += 1) { await c.mouse('mouseMoved', q.x, q.y + i * 20); await sleep(16); }
    await c.mouse('mouseReleased', q.x, q.y + 160);
    ghi('vuốt xuống 160 px ⇒ đóng lớp', await choKhongLop());

    // ô chính chưa vào → phòng chờ.
    // ⚠ Pha "đang xếp bàn" chỉ kéo dài 1,6 s (HUỶ được) mà mỗi cú chạm CDP có thể ngốn cả giây ⇒ cài người gác TRONG TRANG: phòng chờ vừa hiện là chụp
    //   số liệu và bấm HUỶ ngay (vẫn là cú bấm thật vào nút HUỶ, chỉ là nhanh hơn CDP).
    await c.js(`void (window.__pc=new Promise((ok)=>{const mo=new MutationObserver(()=>{const p=document.querySelector('[data-tap=phong-cho]');if(!p)return;const huy=[...p.querySelectorAll('button')].find((x)=>/HUỶ/.test(x.textContent));if(!huy)return;mo.disconnect();setTimeout(()=>{const q=document.querySelector('[data-tap=phong-cho]');const h2=q&&[...q.querySelectorAll('button')].find((x)=>/HUỶ/.test(x.textContent));const r={n:document.querySelectorAll('[data-tap=phong-cho]').length,t:q?q.textContent:'',pha:q?q.dataset.pha:'mat'};if(h2)h2.click();ok(r)},450)});mo.observe(document.body,{childList:true,subtree:true})}))`);
    await cham('[data-o=chinh] [data-o=chinh-vao]', 40);
    await cham('[data-o=chinh] [data-o=chinh-vao]', 40);
    const pc1 = await c.js('Promise.race([window.__pc, new Promise((r) => setTimeout(() => r({ n: 0, t: "", pha: "khong-hien" }), 9000))])');
    await sleep(500);
    ghi('ô chính ▶ VÀO BÀN HÔM NAY bấm ĐÚP ⇒ đúng MỘT phòng chờ (lớp đè toàn màn)', pc1.n === 1);
    dong(tenKhung, 'sảnh', 'ô chính ▶ VÀO BÀN HÔM NAY', 'phòng chờ bàn ngày (lớp đè)', /Q7P2Z|THỬ THÁCH HÔM NAY/i.test(pc1.t), pc1.t.slice(0, 70));
    ghi('phòng chờ HUỶ ⇒ về sảnh, không trận dở nào được tạo', (await c.js("!document.querySelector('[data-tap=phong-cho]')")) && !((await nmock())['POST /holdem/matches']));

    // ĐẤU VỚI MÁY → VÀO BÀN → phòng chờ → vào trận
    await cham('[data-o=may]'); await choLop();
    const vb = await nutTrongLop('VÀO BÀN');
    await c.tap(vb.x, vb.y, 30); await c.tap(vb.x, vb.y, 30);
    await cho("document.querySelector('[data-tap=phong-cho]')", 5000);
    // Lớp trượt còn trong DOM suốt nhịp trượt xuống (NHIP.HUB_TAM + 40 ms) — phòng chờ hiện SỚM hơn thế trên máy nhanh ⇒ chờ hết nhịp đóng
    // (tối đa 1,5 s) rồi mới khẳng định "lớp đóng"; lớp không bao giờ đóng thì vẫn đỏ.
    await cho("!document.querySelector('[role=dialog][data-tam]')", 1500);
    await anh('sanh-phong-cho');
    ghi('lớp ĐẤU VỚI MÁY ▶ VÀO BÀN (bấm đúp) ⇒ lớp đóng, MỘT phòng chờ "ĐẤU VỚI MÁY · N ô"', (await c.js("document.querySelectorAll('[data-tap=phong-cho]').length")) === 1 && /ĐẤU VỚI MÁY · \d+ ô/.test(await c.js("document.querySelector('[data-tap=phong-cho]').textContent")) && (await lop()) === null, JSON.stringify({ n: await c.js("document.querySelectorAll('[data-tap=phong-cho]').length"), t: (await c.js("document.querySelector('[data-tap=phong-cho]')?.textContent ?? ''")).slice(0, 80), lop: ((await lop()) ?? 'null').slice(0, 30) }));
    await cho("location.pathname.startsWith('/arena/tran/')", 20000);
    dong(tenKhung, 'phòng chờ', 'tự vào bàn sau khi đủ ghế', '/arena/tran/<id>', (await duong()).startsWith('/arena/tran/'), await duong());
    ghi('đúng MỘT POST /holdem/matches (không dựng trùng bàn)', ((await nmock())['POST /holdem/matches'] ?? 0) === 1);
    await ctl('tran=dang');
    await c.js('history.back()'); await cho("location.pathname==='/arena' && document.querySelector('[data-o=may]')", 15000); await sleep(400);
    dong(tenKhung, 'trình duyệt', 'Back từ bàn', 'sảnh, lớp ĐÓNG', (await duong()) === '/arena' && (await lop()) === null);
    await c.js('history.forward()'); await cho("location.pathname.startsWith('/arena/tran/')", 10000);
    ghi('Forward ⇒ lại bàn đấu', (await duong()).startsWith('/arena/tran/'));
    await c.js('history.back()'); await cho("document.querySelector('[data-o=may]')", 15000); await sleep(300);

    // RỦ BẠN
    await cham('[data-o=ru]'); await choLop();
    const phat = await nutTrongLop('PHÁT MÃ BÀN'); await c.tap(phat.x, phat.y, 30); await c.tap(phat.x, phat.y, 30);
    await cho("document.body.innerText.includes('K7QX2')", 6000); await sleep(300);
    ghi('RỦ BẠN ▶ PHÁT MÃ BÀN bấm đúp ⇒ đúng MỘT POST /holdem/ban + mã hiện', ((await nmock())['POST /holdem/ban'] ?? 0) === 1 && (await lop()).includes('K7QX2'));
    await anh('sanh-lop-ru-ma');
    await c.phim('Escape', 'Escape', 27); await choKhongLop();

    // MÀN TẬP + BÁCH KHOA + Back/Forward
    const h0 = await c.js('navigation.currentEntry.index');
    await cham('[data-o=man-tap]'); await cho("location.pathname==='/arena/huong-dan'", 8000);
    dong(tenKhung, 'sảnh', 'chạm ô MÀN TẬP (đi thẳng, không qua lớp)', '/arena/huong-dan', (await duong()) === '/arena/huong-dan' && (await c.js('navigation.currentEntry.index')) - h0 === 1);
    await c.js('history.back()'); await cho("location.pathname==='/arena' && document.querySelector('[data-o=may]')", 10000); await sleep(400);
    ghi('Back từ MÀN TẬP ⇒ sảnh, lớp ĐÓNG, không cuộn', (await duong()) === '/arena' && (await lop()) === null && (await cuon()));
    await c.js('history.forward()'); ghi('Forward ⇒ MÀN TẬP lại', await cho("location.pathname==='/arena/huong-dan'", 8000));
    await c.js('history.back()'); await cho("document.querySelector('[data-o=may]')", 10000);
    await cham('[data-o=bach-khoa]'); await cho("location.pathname==='/bach-khoa'", 8000);
    dong(tenKhung, 'sảnh', 'chạm cuốn sách', '/bach-khoa', (await duong()) === '/bach-khoa');
    await c.js('history.back()'); await cho("document.querySelector('[data-o=may]')", 10000);

    // lớp mở + Back ⇒ đóng
    await cham('[data-o=xep]'); await choLop();
    await c.js("history.pushState({}, '', '/arena/huong-dan'); dispatchEvent(new PopStateEvent('popstate'))"); await cho("location.pathname==='/arena/huong-dan'", 8000);
    await c.js('history.back()'); await cho("location.pathname==='/arena' && document.querySelector('[data-o=may]')", 12000); await sleep(400);
    ghi('lớp trượt mở rồi đổi route rồi Back ⇒ sảnh với lớp ĐÓNG (không sống sót qua đổi route)', (await lop()) === null);

    // nút chính: hạt pixel
    const hat = await c.js("new Promise((r)=>{const b=document.querySelector('[data-o=chinh-vao]');const n0=document.querySelectorAll('body > i[aria-hidden]').length;b.click();setTimeout(()=>r(document.querySelectorAll('body > i[aria-hidden]').length-n0),40)})");
    ghi('nút chính: bấm ⇒ HẠT PIXEL phụt (≥ 8 hạt)', hat >= 8, `${hat} hạt`);
    await cho("document.querySelector('[data-tap=phong-cho]')", 4000);
    try { await chamChu('[data-tap=phong-cho]', 'HUỶ'); } catch { /* đã qua pha tìm — phòng chờ tự đi tiếp */ } await sleep(300);

    }
    if (sec('B')) {
    // ───── trạng thái ô chính khác ─────
    await moSanh('dang=1');
    ghi('SẢNH trận dở: ô chính BÀN ĐANG DỞ + VÒNG 5, không cuộn, Oracle không che', /BÀN ĐANG DỞ/.test(await c.js("document.querySelector('[data-o=chinh]').textContent")) && /VÒNG 5/.test(await c.js("document.querySelector('[data-o=chinh]').textContent")) && (await cuon()) && (await c.js(DO_CHONG)).dung.length === 0);
    await anh('sanh-tran-do');
    await cham('[data-o=chinh-vao]'); await cho("location.pathname==='/arena/tran/m-dang'", 8000);
    dong(tenKhung, 'sảnh (trận dở)', 'ô chính ▶ CHƠI TIẾP (bấm đúp không gửi trùng)', '/arena/tran/m-dang', (await duong()) === '/arena/tran/m-dang');
    await c.js('history.back()'); await cho("document.querySelector('[data-o=may]')", 10000);

    await moSanh('ngay=xong');
    const xg = await c.js("document.querySelector('[data-o=chinh]').textContent");
    ghi('SẢNH hôm nay xong: TOP 18% · hạng 41/228 · bàn mới 00:00; không cuộn', /TOP 18%/.test(xg) && /hạng 41\/228/.test(xg) && /00:00/.test(xg) && (await cuon()));
    await anh('sanh-xong');
    await cham('[data-o=chinh-vao]'); await choLop();
    dong(tenKhung, 'sảnh (xong)', 'ô chính ▶ ĐẤU VỚI MÁY', 'lớp trượt ĐẤU VỚI MÁY', /thử chiến thuật thoải mái/i.test((await lop()) ?? ''));
    await c.phim('Escape', 'Escape', 27); await choKhongLop();

    await moSanh('ngay=dang');
    ghi('SẢNH thử thách đang chơi: nút ▶ CHƠI TIẾP BÀN HÔM NAY', /CHƠI TIẾP BÀN HÔM NAY/.test(await c.js("document.querySelector('[data-o=chinh]').textContent")));

    // sau màn tập (Delphi chỉ Bách khoa)
    await ctl('mode=so&reset=1');
    await c.js("localStorage.setItem('delphi:man-tap:da-qua','xong');localStorage.removeItem('delphi:sanh:da-chi-bach-khoa')");
    await c.go(`${APP}arena`); await cho("document.querySelector('[data-testid=delphi-chi-bach-khoa]')", 30000); await sleep(600);
    ghi('SẢNH sau màn tập: ghi chú Delphi nổi (không đẩy lưới), nút sách sáng, không cuộn', (await cuon()) && /nutSachChi/.test(await c.js("document.querySelector('[data-testid=nut-bach-khoa]').className")));
    await anh('sanh-sau-man-tap');
    await cham('[data-testid=delphi-mo-bach-khoa]'); await cho("location.pathname==='/bach-khoa'", 8000);
    dong(tenKhung, 'sảnh (sau màn tập)', 'MỞ BÁCH KHOA', '/bach-khoa', (await duong()) === '/bach-khoa');
    await c.js("localStorage.setItem('delphi:man-tap:da-qua','bo_qua')");

    }
    if (sec('C')) {
    // ───── deep link ─────
    for (const [mode, p, ok, ten] of [
      ['so', 'arena', "!!document.querySelector('[data-o=may]')", 'sảnh (đã đăng nhập)'],
      ['khach', 'arena', "!!document.querySelector('[data-o=may]')", 'sảnh (khách)'],
      ['chua', 'arena', "/ĐĂNG NHẬP|ĐĂNG KÝ|đăng nhập/i.test(document.body.innerText)", 'sảnh (CHƯA đăng nhập ⇒ cổng mời đăng nhập tại chỗ)'],
      ['so', 'arena/ban/k7qx2', "!!document.querySelector('[data-tap=phong-cho]') || location.pathname.startsWith('/arena/tran/')", 'link mời đúng mã ⇒ phòng chờ (rồi vào bàn)'],
      ['so', 'arena/ban/ab', "/Mã bàn là 5 ký tự/.test(document.body.innerText)", 'link mời SAI mã ⇒ lớp RỦ BẠN nói lỗi'],
      ['so', 'arena/huong-dan', "document.body.innerText.length>30", 'màn tập'],
      ['so', 'arena/khong-co', "document.body.innerText.length>30", 'đường không có ⇒ 404 có chữ'],
    ]) {
      await ctl(`mode=${mode}&reset=1&ngay=chua&dang=0`); await c.go(APP + p);
      const dung = await cho(ok, 30000);
      const loi = await c.js('/Đã xảy ra lỗi|Unexpected Application Error|MÀN HÌNH VỪA VẤP/i.test(document.body.innerText)');
      dong(tenKhung, 'deep link', `mở thẳng /${p} (${ten})`, 'mở được, không màn lỗi', dung && !loi, `dung=${dung} loi=${loi} path=${await duong()}`);
    }

    }
    if (sec('D')) {
    // ───── trễ mạng ─────
    // ⚠ Gói JS nạp NGUỘI trước rồi mới bóp mạng và đổi màn BẰNG ROUTER (pushState) — dev server nhả hàng trăm module, bóp từ đầu thì kịch bản chờ hàng phút.
    //   Phần bị bóp là ĐÚNG phần SPEC 5b.2 hỏi: các cuộc gọi API khi vào sảnh (trễ ≥ 1,5 s, băng thông thấp), không phải tải gói.
    await ctl('mode=so&reset=1&ngay=chua&dang=0&lat=0');
    await c.go(APP); await cho("document.querySelector('[data-o=mua]')", 40000);
    await c.mang({ tre: 1800, xuong: 60 * 1024, len: 60 * 1024 });
    await ctl('lat=-1');                                         // API GIỮ: chỗ giữ sẵn đứng yên, không đua với đồng hồ
    await c.js("history.pushState({}, '', '/arena'); dispatchEvent(new PopStateEvent('popstate'))");
    // Người đã qua màn tập (máy nhớ) vào sảnh NGAY — không đợi tiến độ (D336); người LẦN ĐẦU thì "ĐANG MỞ ĐẤU TRƯỜNG…" (bài `man_tap_dau` II canh nhánh đó).
    const veNgay = await cho("document.querySelector('[data-o=may]')", 40000);
    ghi('mạng chậm: sảnh vẽ NGAY đủ khung (người đã qua màn tập), API còn bị giữ — không màn trắng', veNgay);
    await sleep(1200);
    const dangTai = await c.js(DO_KHOI(KHOI_SANH));
    const chuTai = await c.js("document.querySelector('[data-o=chinh]').textContent");
    ghi('đang tải thử thách: ô chính là CHỖ GIỮ SẴN ("đang hỏi…", nút khoá) — KHÔNG số 0 / % giả (D62)', /đang hỏi/.test(chuTai) && !/\b0%|\b0\b/.test(chuTai.replace(/MÙA 0\.0/, '')) && await c.js("document.querySelector('[data-o=chinh-vao]').disabled"));
    await anh('sanh-dang-tai');
    ghi('đang tải: không thanh cuộn', await cuon());
    await sleep(1500);
    await ctl('tha=1&lat=0');
    await cho("document.querySelector('[data-o=chinh]').textContent.includes('cả nước')", 40000); await sleep(1200);
    const daTai = await c.js(DO_KHOI(KHOI_SANH));
    const nhay = KHOI_SANH.filter((k) => dangTai[k] && daTai[k] && dangTai[k].some((v, i) => Math.abs(v - daTai[k][i]) > 1)).map((k) => `${k}: ${dangTai[k]} → ${daTai[k]}`);
    ghi('⭐ API bị GIỮ rồi thả (Slow 3G, trễ 1,8 s): KHÔNG khối nào mọc/nhảy khi dữ liệu về (toạ độ 6 khối trước = sau ±1 px)', nhay.length === 0, nhay.join(' | '));
    ghi('dữ liệu về: nút VÀO BÀN HÔM NAY mở khoá, không cuộn', !(await c.js("document.querySelector('[data-o=chinh-vao]').disabled")) && (await cuon()));
    await cho("document.querySelector('[data-testid=oracle-head]')", 20000);
    const oc = await c.js(DO_CHONG);
    ghi('mạng chậm: Oracle (khi lời về) vẫn không che nút nào', oc.co && oc.dung.length === 0, JSON.stringify(oc.dung ?? 'không thấy head'));
    await c.mang();

    // lỗi + thử lại
    await ctl('loi=1&lat=0&reset=1'); await c.go(`${APP}arena`);
    await cho("document.querySelector('[data-chinh][data-trang-thai=loi]')", 40000); await sleep(400);
    ghi('lỗi /holdem/ngay: ô chính nói "chưa đọc được thử thách hôm nay" + nút ↻ THỬ LẠI; không cuộn', /chưa đọc được/.test(await c.js("document.querySelector('[data-o=chinh]').textContent")) && (await cuon()));
    await anh('sanh-loi');
    const n0 = (await nmock())['GET /holdem/ngay'] ?? 0;
    await cham('[data-o=chinh-vao]', 30); await cham('[data-o=chinh-vao]', 30); await sleep(2500);
    const dn = ((await nmock())['GET /holdem/ngay'] ?? 0) - n0;
    ghi('bấm ↻ THỬ LẠI ĐÚP khi lỗi ⇒ không bão request (1–2 lượt)', dn >= 1 && dn <= 2, `+${dn}`);
    await ctl('loi=0'); await sleep(1500);
    await cham('[data-o=chinh-vao]', 30);
    ghi('API khỏe lại ⇒ THỬ LẠI ⇒ ô chính hiện thử thách thật', await cho("document.querySelector('[data-chinh][data-trang-thai=chua]')", 12000));

    // mất mạng
    await ctl('off=1&loi=0'); await c.go(`${APP}arena`);
    await sleep(9000);
    const off = await c.js("document.body.innerText");
    ghi('mất mạng: không màn trắng — còn chữ nói rõ (đang mở / không tải được), không số 0 giả', off.length > 20 && !/Unexpected Application Error|MÀN HÌNH VỪA VẤP/.test(off));
    await ctl('off=0');

    }
    if (sec('E')) {
    // ───────────────────────── MÀN KẾT ─────────────────────────
    for (const [ten, q, slug, pc] of [['hạng 3', 'hang=3&pc=1', 'hang3', true], ['hạng 1', 'hang=1&pc=1', 'hang1', true], ['CHÁY', 'hang=6&pc=1', 'chay', true], ['thiếu phong cách', 'hang=3&pc=0', 'khong-pc', false]]) {
      await ctl(`mode=so&reset=1&lat=0&off=0&loi=0&loiAutopsy=0&tran=xong&ngay=chua&${q}`);
      await c.go(`${APP}arena/tran/m-xong`);
      await cho("document.querySelector('[data-testid=man-ket]')", 40000); await sleep(1300);
      ghi(`KẾT ${ten}: không thanh cuộn (scrollHeight − clientHeight = 0)`, await cuon());
      const kk = await c.js(DO_KHOI(['toi', 'pc', 'lat', 'ban', 'khoe', 'doi', 've-sanh']));
      ghi(`KẾT ${ten}: ô của mình + PHONG CÁCH + 4 ô nhỏ + VỀ SẢNH đều NẰM TRONG màn (đáy VỀ SẢNH ≤ cao màn − 4)`, Object.values(kk).every((r) => r && r[1] >= 0 && r[1] + r[3] <= h) && kk['ve-sanh'][1] + kk['ve-sanh'][3] <= h - 4, JSON.stringify(kk));
      ghi(`KẾT ${ten}: PHONG CÁCH là ô LỚN NHẤT (diện tích)`, ['toi', 'lat', 'ban', 'khoe', 'doi'].every((k) => kk.pc[2] * kk.pc[3] > kk[k][2] * kk[k][3]));
      ghi(`KẾT ${ten}: KHÔNG có Oracle nào (route toàn tâm — không che được nút)`, !(await c.js("!!document.querySelector('[data-testid=oracle-head],[data-testid=oracle-chat]')")));
      if (pc) ghi(`KẾT ${ten}: thanh chấm điểm THẬT (thang E→SSS) có mặt trong ô PHONG CÁCH`, await c.js("!!document.querySelector('[data-o=pc] [data-tap=phong-cach]')"));
      else ghi('KẾT thiếu phong cách: ô nói "chưa có hạng phong cách", không bịa hạng', /chưa có hạng phong cách/.test(await c.js("document.querySelector('[data-o=pc]').textContent")));
      await anh(`ket-${slug}`);
    }
    // ô → lớp (hạng 3)
    await ctl('hang=3&pc=1&reset=1'); await c.go(`${APP}arena/tran/m-xong`);
    await cho("document.querySelector('[data-testid=man-ket]')", 40000); await sleep(1000);
    for (const [dau, re, ten] of [['toi', 'LÁ ĐÃ CẦM', 'ô của mình'], ['pc', 'GHI VÀO THẺ', 'PHONG CÁCH'], ['lat', 'lan_anh', 'LẬT BÀI'], ['ban', 'TIN GIẢ', 'BẢN ĐỒ'], ['khoe', 'CHIA SẺ', 'KHOE'], ['doi', 'DẤU MỐC', 'ĐỘI']]) {
      await c.js(`document.querySelector('[data-o=${dau}]').focus()`);
      await cham(`[data-o=${dau}]`); await choLop();
      const t = (await lop()) ?? '';
      dong(tenKhung, 'màn kết', `chạm ô ${ten}`, `lớp trượt có "${re}"`, new RegExp(re).test(t));
      ghi(`KẾT lớp ${ten}: không làm trang cuộn`, await cuon());
      await anh(`ket-lop-${dau}`);
      await c.phim('Escape', 'Escape', 27);
      ghi(`KẾT Esc đóng lớp ${ten} + FOCUS về đúng ô`, (await choKhongLop()) && (await c.js("document.activeElement?.getAttribute('data-o')")) === dau);
    }
    await cham('[data-o=lat]'); await choLop(); await c.tap(w / 2, 24, 40);
    ghi('KẾT chạm NỀN ⇒ đóng lớp', await choKhongLop());
    await cham('[data-o=ban]'); await choLop();
    const q2 = await c.js("(()=>{const b=document.querySelector('[role=dialog]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+10}})()");
    await c.mouse('mouseMoved', q2.x, q2.y); await c.mouse('mousePressed', q2.x, q2.y);
    for (let i = 1; i <= 8; i += 1) { await c.mouse('mouseMoved', q2.x, q2.y + i * 20); await sleep(16); }
    await c.mouse('mouseReleased', q2.x, q2.y + 160);
    ghi('KẾT vuốt xuống ⇒ đóng lớp', await choKhongLop());
    // VỀ SẢNH
    const hk = await c.js('navigation.currentEntry.index');
    await cham('[data-o=ve-sanh]', 30); await cham('[data-o=ve-sanh]', 30);
    await cho("location.pathname==='/arena' && document.querySelector('[data-o=may]')", 10000);
    dong(tenKhung, 'màn kết', 'nút ▶ VỀ SẢNH (bấm đúp)', '/arena (một mục lịch sử)', (await duong()) === '/arena' && (await c.js('navigation.currentEntry.index')) - hk === 1);
    await c.js('history.back()'); await cho("document.querySelector('[data-testid=man-ket]')", 20000);
    dong(tenKhung, 'trình duyệt', 'Back từ sảnh', 'màn kết (không treo, không bàn sống)', (await c.js("!!document.querySelector('[data-testid=man-ket]')")) && (await cuon()));
    await c.js('history.forward()'); ghi('Forward ⇒ sảnh', await cho("location.pathname==='/arena'", 8000));

    }
    if (sec('F')) {
    // kết: mạng chậm + lỗi autopsy
    await ctl('reset=1&hang=3&pc=1&lat=0');
    await c.go(APP); await cho("document.querySelector('[data-o=mua]')", 40000);
    await c.mang({ tre: 1800, xuong: 60 * 1024, len: 60 * 1024 });
    await c.js("history.pushState({}, '', '/arena/tran/m-xong'); dispatchEvent(new PopStateEvent('popstate'))");
    await cho("document.querySelector('[data-testid=man-ket]')", 60000); await sleep(1200);
    ghi('KẾT mạng chậm (Slow 3G, trễ 1,8 s): màn kết vẽ xong, không cuộn', await cuon());
    await c.mang();
    await ctl('loiAutopsy=1&reset=1'); await c.go(`${APP}arena/tran/m-xong`);
    await cho("document.body.innerText.includes('chưa tải được bảng kết quả')", 40000); await sleep(300);
    const tl = await c.js("document.body.innerText");
    ghi('KẾT lỗi tải bảng kết quả: chữ nói rõ + ↻ THỬ LẠI + ‹ VỀ SẢNH (không bàn sống của trận đã chết)', /chưa tải được bảng kết quả/.test(tl) && /THỬ LẠI/.test(tl) && /VỀ SẢNH/.test(tl));
    await ctl('loiAutopsy=0');
    const nt = await c.js("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/THỬ LẠI/.test(x.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    if (nt) await c.tap(nt.x, nt.y, 30);
    ghi('khỏe lại ⇒ THỬ LẠI ⇒ màn kết hiện', await cho("document.querySelector('[data-testid=man-ket]')", 20000));
    await ctl('mode=chua&reset=1'); await c.go(`${APP}arena/tran/m-xong`); await sleep(5000);
    ghi('KẾT mở thẳng khi CHƯA đăng nhập ⇒ cổng mời đăng nhập tại chỗ (không màn lỗi)', !(await c.js('/Unexpected Application Error|MÀN HÌNH VỪA VẤP/.test(document.body.innerText)')));

    // giảm chuyển động
    await ctl('mode=so&reset=1&hang=3&pc=1');
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await c.go(`${APP}arena/tran/m-xong`); await cho("document.querySelector('[data-testid=man-ket]')", 40000); await sleep(800);
    await cham('[data-o=lat]'); await choLop();
    const td = await c.js("getComputedStyle(document.querySelector('[role=dialog][data-tam]')).transitionDuration");
    ghi('prefers-reduced-motion: lớp trượt hiện/ẩn TỨC THÌ (transition-duration ≈ 0, ≤ 1 ms — luật giảm chuyển động của app đặt 0,01 ms) — chữ + thứ tự giữ nguyên', td.split(',').every((x) => parseFloat(x) <= 0.001), td);
    const hat2 = await c.js("new Promise((r)=>{const b=document.querySelector('[data-o=ve-sanh]');b.dispatchEvent(new MouseEvent('click',{bubbles:true}));setTimeout(()=>r(document.querySelectorAll('body > i[aria-hidden]').length),40)})");
    ghi('prefers-reduced-motion: nút chính KHÔNG phụt hạt', hat2 === 0, `${hat2} hạt`);
    await c.send('Emulation.setEmulatedMedia', { features: [] });
    }
  } finally { await c.dong(); }
}

const sv = await khoiDongApi(PORT_API);
try {
  let i = 0;
  for (const [w, h] of KHUNG) { await chayKhung(w, h, 9500 + (i += 1)); }
} finally { sv.close(); }

const do_ = bang.filter((b) => !b.ok);
console.log('\n══ BẢNG 5b.3 — nút / ô / cử chỉ → đích (bấm thật trên Chrome) ══');
console.log('| khung | màn | cử chỉ | đích | kết quả |\n|---|---|---|---|---|');
for (const r of b53) console.log(`| ${r.khung} | ${r.tu} | ${r.cuChi} | ${r.dich} | ${r.ok ? 'PASS' : 'FAIL'}${r.ct ? ` (${r.ct})` : ''} |`);
console.log(`\nTỔNG: ${bang.length - do_.length}/${bang.length} PASS${do_.length ? ` · FAIL: ${do_.map((b) => b.ten).join(' | ')}` : ''}`);
process.exit(do_.length ? 1 : 0);
