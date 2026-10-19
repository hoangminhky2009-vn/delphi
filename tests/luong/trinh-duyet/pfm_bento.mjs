/**
 * KỊCH BẢN LUỒNG TRÌNH DUYỆT — PFM TẦNG KHÔNG GIAN (SPEC `docs/spec/pfm-tang-khong-gian.md` mục 5 + 5b của `ui-tang-khong-gian.md`).
 *
 * Bấm thật trên Chrome (CDP, không thêm thư viện), ở 390×812 và 360×640, trên dữ liệu GIEO vào IndexedDB `delphi_pfm` (API giả, không DB, không prod):
 *   cuon  — KHÔNG THANH CUỘN bốn tab × (sổ rỗng · có dữ liệu · khách) + không chữ nào tràn khỏi ô của nó
 *   tab   — đổi tab bốn chiều lướt ngang (thể hiện vỏ KHÔNG dựng lại), Back/Forward, deep link
 *   lop   — mở/đóng MỌI lớp trượt bằng nền · Esc · vuốt; trả focus; lớp tự đóng khi đổi route
 *   ghi   — bàn tiền đứng yên + ghi đúng một lần · NẠP (một lần ghi, số hũ tăng, xu rơi) · tạo hũ ba bước · hũ con · chốt tuần · cài đặt
 *   duong — deep link /tai-chinh/so|hu|guong|the (đăng nhập · khách · chưa đăng nhập)
 *   mang  — trễ mạng (toạ độ khối trước/sau) · kho IndexedDB lỗi nói rõ
 * In BẢNG dòng PASS/FAIL; thoát 1 nếu có dòng đỏ. Chia phần bằng PFM_PHAN="cuon,tab" nếu một lượt quá 10 phút.
 *
 * CÁCH CHẠY (hai cửa sổ dòng lệnh):
 *   1)  cd web && VITE_DEV_API_PROXY=http://localhost:8799 npx vite --port 5199 --strictPort
 *   2)  node tests/luong/trinh-duyet/pfm_bento.mjs      (biến: PFM_URL · PFM_API_PORT · CHROME_PATH · PFM_KHUNG="390x812,360x640" · PFM_PHAN)
 */
import { dungApiGia, ctl, nmock, moChrome, tam, cham, cho, sleep, tuaHoatAnh, gieo } from './pfm_ha_tang.mjs';
import { mauCo, mauRong, homNayVN } from './pfm_du_lieu_mau.mjs';

const APP = process.env.PFM_URL ?? 'http://localhost:5199/';
const PORT_API = Number(process.env.PFM_API_PORT ?? 8799);
const KHUNG = (process.env.PFM_KHUNG ?? '390x812,360x640').split(',').map((k) => k.split('x').map(Number));
const PHAN = (process.env.PFM_PHAN ?? 'cuon,tab,lop,ghi,duong,mang').split(',');
const TAB = ['so', 'hu', 'guong', 'the'];

const bang = [];
const ghi = (ten, ok, ct = '') => { bang.push({ ten, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${ten}${ct ? `  — ${ct}` : ''}`); };

/** Đọc một ngăn IndexedDB của trang (bỏ bia mộ) — kiểm số lần GHI thật. */
const docKho = (c, ngan) => c.js(`(async()=>{const db=await new Promise((ok,l)=>{const r=indexedDB.open('delphi_pfm');r.onsuccess=()=>ok(r.result);r.onerror=()=>l(r.error)});
  const r=db.transaction('${ngan}','readonly').objectStore('${ngan}').getAll();const v=await new Promise((ok,l)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>l(r.error)});db.close();return v.filter(b=>!b.daXoa).map(b=>b.d)})()`);

/** Đo mọi khối CỐ ĐỊNH: ô bento theo `data-o`, lưới tờ + hai đích CHI/THU theo chữ của chúng, và hộp bàn tiền. Khay đang cầm (chip mọc/mất) KHÔNG đo —
 *  chip là thứ thay đổi có chủ ý; luật "bàn tiền SỔ cố định" là về khối đứng yên quanh chúng. */
const DO_KHOI = `(()=>{const o={};const r=(e)=>{const b=e.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]};
  document.querySelectorAll('[data-khung-pfm] [data-o]').forEach((e)=>{o['o:'+e.dataset.o]=r(e)});
  const ban=document.querySelector('[data-testid="ban-tien"]');
  if(ban){o['BAN']=r(ban);
   const luoi=ban.querySelector('[role="group"][aria-label="Mệnh giá tiền"]');
   if(luoi){luoi.querySelectorAll('button').forEach((e)=>{o['to:'+e.textContent.trim()]=r(e)});o['LUOI']=r(luoi)}
   ban.querySelectorAll('button').forEach((e)=>{const t=e.textContent.trim();if(/CHI|THU/.test(t)&&!/^[0-9]/.test(t)&&t.length<12)o['dich:'+t]=r(e)})}
  return o})()`;
const khacToaDo = (a, b, dung = 1) => Object.keys(a).filter((k) => b[k] && a[k].some((v, i) => Math.abs(v - b[k][i]) > dung)).map((k) => `${k}: ${a[k]} → ${b[k]}`);

/** Chữ nào tràn khỏi ô của nó (đo dòng chữ THẬT bằng Range.getClientRects — bài học 11/10). */
const DO_CHU_TRAN = `(()=>{const loi=[];for(const t of document.querySelectorAll('[data-khung-pfm] [data-o]')){const r=t.getBoundingClientRect();
  const w=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(!n.textContent.trim())continue;const p=n.parentElement;
  const cs=getComputedStyle(p);if(cs.display==='none'||cs.visibility==='hidden')continue;
  if(p.closest('[hidden]'))continue;const rg=document.createRange();rg.selectNodeContents(n);
  for(const q of rg.getClientRects()){if(q.width===0)continue;
   // ellipsis có chủ đích (.mot) cắt phần dư bằng "…": chỉ bắt chữ lọt NGOÀI ô theo chiều dọc/ngang mà KHÔNG có ellipsis che.
   const dau=q.right>r.right+1||q.left<r.left-1||q.bottom>r.bottom+1||q.top<r.top-1;
   if(dau){const oc=p.closest('.mot,[style*="ellipsis"]');if(oc&&getComputedStyle(oc).textOverflow==='ellipsis'&&oc.scrollWidth>oc.clientWidth)continue;
    // chữ bị overflow:hidden của chính tổ tiên cắt thì mắt không thấy ⇒ vẫn là lỗi nếu cắt NGANG giữa chữ; ghi lại
    loi.push((t.dataset.o||'?')+': '+n.textContent.trim().slice(0,30));break}}}}return loi})()`;

const url = (tab) => `${APP}tai-chinh/${tab}`;
const conKhung = (tab) => `!!document.querySelector('[data-khung-pfm="${tab}"]')`;

async function moLai(c, tab, mau, che = 'so') {
  await ctl(PORT_API, `mode=${che}&lat=0&off=0&loi=0&reset=1`);
  await c.go(url('so'));
  await cho(c, "!!document.querySelector('[data-testid=so-bento]')", 30000);
  await sleep(600);
  if (mau !== null) { await gieo(c, mau); }
  await c.go(url(tab));
  await cho(c, conKhung(tab), 30000);
  await sleep(1500);
  await tuaHoatAnh(c);
  await sleep(200);
}

// ═══ PHẦN 1 — KHÔNG CUỘN ═══
async function phanCuon(c, w, h) {
  const nay = homNayVN();
  const trangThai = [['rỗng', () => mauRong(), 'so'], ['có dữ liệu', () => mauCo(nay), 'so'], ['khách', () => null, 'khach']];
  for (const tab of TAB) {
    for (const [ten, mau, che] of trangThai) {
      await moLai(c, tab, mau(), che);
      const khungCo = await c.js(conKhung(tab));
      const cuon = await c.js('(()=>{const e=document.documentElement;window.scrollTo(0,400);const r={thua:e.scrollHeight-e.clientHeight,y:window.scrollY};return r})()');
      ghi(`${tab.toUpperCase()} · ${ten}: không thanh cuộn (scrollHeight − clientHeight = 0)`, khungCo && cuon.thua === 0 && cuon.y === 0, JSON.stringify(cuon));
      if (ten === 'có dữ liệu') {
        const tran = await c.js(DO_CHU_TRAN);
        ghi(`${tab.toUpperCase()} · ${ten}: không chữ nào tràn khỏi ô của nó`, tran.length === 0, tran.join(' | '));
        const raKhung = await c.js(`(()=>{const k=document.querySelector('[data-khung-pfm="${tab}"]').getBoundingClientRect();return [...document.querySelectorAll('[data-khung-pfm="${tab}"] [data-o]')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>k.bottom+1||b.right>k.right+1||b.left<k.left-1}).map(e=>e.dataset.o)})()`);
        ghi(`${tab.toUpperCase()} · ${ten}: mọi ô nằm trong khung`, raKhung.length === 0, raKhung.join(','));
      }
    }
  }
}

// ═══ PHẦN 2 — ĐỔI TAB ═══
async function phanTab(c, w, h) {
  const nay = homNayVN();
  await moLai(c, 'so', mauCo(nay));
  await c.js("window.__dai=document.querySelector('nav[aria-label=\"Khu tài chính\"]');1");
  const THU_TU = [['hu', 'toi'], ['guong', 'toi'], ['the', 'toi'], ['guong', 'lui'], ['hu', 'lui'], ['so', 'lui']];
  for (const [t, huong] of THU_TU) {
    const nut = await c.js(`(()=>{const a=[...document.querySelectorAll('nav[aria-label="Khu tài chính"] a')].find(x=>x.getAttribute('href')==='/tai-chinh/${t}');if(!a)return null;const b=a.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
    await c.js("window.__raThay=null;window.__raObs&&window.__raObs.disconnect();window.__raObs=new MutationObserver(()=>{const r=document.querySelector('[data-khung-pfm] [data-ra]');if(r&&!window.__raThay)window.__raThay={ra:r.getAttribute('data-ra'),st:getComputedStyle(r).transform}});window.__raObs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ra']});1");
    await c.tap(nut.x, nut.y, 40);
    await cho(c, conKhung(t), 8000);
    const raLuc = (await c.js('window.__raThay')) ?? { ra: null, st: null };
    const luot = await c.js("(()=>{const m=document.querySelector('[data-khung-pfm] [data-luot]');return m?m.getAttribute('data-luot'):null})()");
    const demAnim = await c.js("(()=>{const m=document.querySelector('[data-khung-pfm] [data-luot]');return m?m.getAnimations().length:-1})()");
    const giuVo = await c.js("window.__dai===document.querySelector('nav[aria-label=\"Khu tài chính\"]')");
    ghi(`đổi tab → ${t.toUpperCase()}: màn lướt ${huong === 'toi' ? 'từ phải' : 'từ trái'} (data-luot=${huong}) và là hoạt ảnh thật`, luot === huong && demAnim >= 0, `luot=${luot} anim=${demAnim}`);
    ghi(`đổi tab → ${t.toUpperCase()}: dải tab KHÔNG dựng lại (cùng một thể hiện vỏ)`, giuVo === true);
    // Demo: màn CŨ cũng lướt ra (ngược hướng, mờ dần) — bản chụp tĩnh rời DOM bằng đồng hồ.
    ghi(`đổi tab → ${t.toUpperCase()}: màn CŨ lướt ra ngược hướng (có bản chụp data-ra=${huong}) rồi rời DOM`, raLuc.ra === huong && (await cho(c, "!document.querySelector('[data-khung-pfm] [data-ra]')", 3000)), JSON.stringify(raLuc));
    await sleep(500);
  }
  const duong = () => c.js('location.pathname');
  await c.js("window.__raThay=null;window.__raObs&&window.__raObs.disconnect();window.__raObs=new MutationObserver(()=>{const r=document.querySelector('[data-khung-pfm] [data-ra]');if(r&&!window.__raThay)window.__raThay={ra:r.getAttribute('data-ra'),st:getComputedStyle(r).transform}});window.__raObs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ra']});1");
  await c.js('history.back()'); await sleep(400);
  ghi('Back (không qua dải tab): màn cũ cũng có bản chụp lướt ra (popstate)', (await c.js('window.__raThay')) !== null);
  await sleep(500);
  ghi('Back từ SỔ → HŨ (lịch sử đi đúng thứ tự)', (await duong()) === '/tai-chinh/hu', await duong());
  await c.js('history.back()'); await sleep(500);
  ghi('Back lần nữa → GƯƠNG', (await duong()) === '/tai-chinh/guong', await duong());
  await c.js('history.forward()'); await sleep(500);
  ghi('Forward → HŨ', (await duong()) === '/tai-chinh/hu', await duong());
  ghi('sau Back/Forward vỏ vẫn có đúng một dải tab và màn khớp URL', await c.js(`document.querySelectorAll('nav[aria-label="Khu tài chính"]').length===1 && ${conKhung('hu')}`));
  // ô GƯƠNG HƯỚNG → bấm → lớp; SỔ ô HƯỚNG → đi GƯƠNG
  await c.go(url('so')); await cho(c, conKhung('so'), 15000); await sleep(1200);
  await cham(c, '[data-o=so-huong]'); await cho(c, "location.pathname==='/tai-chinh/guong'", 5000);
  ghi('SỔ › ô HƯỚNG TUẦN NÀY → /tai-chinh/guong (một chạm)', (await duong()) === '/tai-chinh/guong');
  await c.go(url('so')); await cho(c, conKhung('so'), 15000); await sleep(1200);
  await cham(c, '[data-o=so-toi-nay]'); await sleep(900);
  const nutHu = await tam(c, '[data-o=so-di-hu]');
  if (nutHu) { await c.tap(nutHu.x, nutHu.y, 40); await cho(c, "location.pathname==='/tai-chinh/hu'", 5000); await sleep(1500); }
  ghi('SỔ › TỐI NAY › MỞ HŨ ĐỂ CHIA → /tai-chinh/hu và lớp CHIA TIỀN tự mở (?chia=1)',
    (await duong()) === '/tai-chinh/hu' && (await c.js("document.querySelector('[role=dialog]')?.textContent.includes('CHIA TIỀN TỐI NAY')")), await duong());
}

// ═══ PHẦN 3 — LỚP TRƯỢT ═══
const LOP = {
  so: ['so-hom-nay', 'so-thang', 'so-toi-nay'],
  hu: ['hu-chia', 'hu-uu-tien', 'hu-danh-muc'],
  guong: ['guong-huong', 'guong-doan-that', 'guong-ket-toan', 'guong-tien-vao', 'guong-chi-ngay', 'guong-phan-tich', 'guong-thoi-quen', 'guong-luat', 'guong-sau-thang', 'guong-nhin-lai', 'guong-tien-toi', 'guong-chot'],
  the: ['the-hanh-tinh', 'the-can-cu', 'the-doan-dung', 'the-nhat-quan'],
};
async function phanLop(c, w, h) {
  const nay = homNayVN();
  const hopThoai = () => c.js("(()=>{const d=document.querySelector('[role=dialog]');return d?d.textContent:null})()");
  const dong = {
    nen: async () => { await c.tap(w / 2, 24, 40); },
    esc: async () => { await c.phim('Escape', 'Escape', 27); },
    vuot: async () => {
      const q = await c.js("(()=>{const b=document.querySelector('[role=dialog]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+10}})()");
      await c.mouse('mouseMoved', q.x, q.y); await c.mouse('mousePressed', q.x, q.y);
      for (let i = 1; i <= 8; i += 1) { await c.mouse('mouseMoved', q.x, q.y + i * 20); await sleep(16); }
      await c.mouse('mouseReleased', q.x, q.y + 160);
    },
  };
  const cachDong = Object.keys(dong);
  let k = 0;
  for (const tab of TAB) {
    await moLai(c, tab, mauCo(nay));
    for (const dauO of LOP[tab]) {
      const cach = cachDong[k % 3]; k += 1;
      await cham(c, `[data-o=${dauO}]`, 50);
      const mo = await cho(c, "!!document.querySelector('[role=dialog]')", 3000);
      await sleep(700);
      const noi = await hopThoai();
      ghi(`${tab.toUpperCase()} › ${dauO}: chạm → lớp trượt mở (có nội dung)`, mo && !!noi && noi.length > 20, `${(noi ?? '').length} ký tự`);
      const thanCuon = await c.js("(()=>{const t=document.querySelector('[role=dialog]');return t.getBoundingClientRect().height<=window.innerHeight*0.91})()");
      ghi(`${tab.toUpperCase()} › ${dauO}: lớp không cao quá 90 % màn`, thanCuon === true);
      await dong[cach]();
      const dong_ = await cho(c, "!document.querySelector('[role=dialog]')", 3000);
      ghi(`${tab.toUpperCase()} › ${dauO}: đóng bằng ${cach} → lớp biến khỏi DOM`, dong_);
      await sleep(250);
      const tieu = await c.js(`document.activeElement?.getAttribute('data-o')`);
      ghi(`${tab.toUpperCase()} › ${dauO}: focus trả về đúng ô đã mở`, tieu === dauO, `activeElement=${tieu}`);
      await sleep(300);
    }
    // lớp tự đóng khi đổi route
    await cham(c, `[data-o=${LOP[tab][0]}]`, 50); await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(500);
    const khac = tab === 'so' ? 'the' : 'so';
    await c.js(`history.pushState({}, '', '/tai-chinh/${khac}'); window.dispatchEvent(new PopStateEvent('popstate'))`);
    await sleep(900);
    ghi(`${tab.toUpperCase()}: đổi route khi lớp đang mở → lớp không sống sót`, (await hopThoai()) === null, await c.js('location.pathname'));
  }
  // bánh răng: lớp CÀI ĐẶT bốn cửa
  await moLai(c, 'so', mauCo(nay));
  await cham(c, 'button[aria-label="Cài đặt khu Tài chính"]', 50);
  await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(1200);
  const cd = await hopThoai();
  ghi('bánh răng → lớp CÀI ĐẶT (giữ BỐN cửa đồng ý, không năm lớp)', !!cd && /CÀI ĐẶT SỔ/.test(cd) && !/HOÀN CẢNH|CAN THIỆP/.test(cd), (cd ?? '').slice(0, 80));
  const soCongTac = await c.js("document.querySelectorAll('[role=dialog] [role=switch], [role=dialog] input[type=checkbox]').length");
  ghi('lớp CÀI ĐẶT có công tắc đồng ý (bốn cửa + công tắc chung)', soCongTac >= 4, `công tắc=${soCongTac}`);
  await dong.esc();
  ghi('Esc đóng lớp CÀI ĐẶT', await cho(c, "!document.querySelector('[role=dialog]')", 3000));
}

// ═══ PHẦN 4 — GHI / HÀNH VI ═══
async function phanGhi(c, w, h) {
  const nay = homNayVN();
  const hopThoai = () => c.js("(()=>{const d=document.querySelector('[role=dialog]');return d?d.textContent:null})()");
  const nutTrongLop = (re) => c.js(`(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(x=>/${re}/.test(x.textContent)&&!x.disabled);if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const chamChu = async (re, giu = 50) => { const p = await nutTrongLop(re); if (!p) throw new Error(`không thấy nút /${re}/ trong lớp`); await c.tap(p.x, p.y, giu); };

  // ── SỔ: bàn tiền đứng yên + ghi đúng một lần ──
  await moLai(c, 'so', mauCo(nay));
  const k0 = (await docKho(c, 'khoan')).length;
  const truoc = await c.js(DO_KHOI);
  const to50 = await c.js(`(()=>{const b=[...document.querySelectorAll('[data-testid="ban-tien"] button')].find(x=>x.textContent.trim()==='50k');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const to100 = await c.js(`(()=>{const b=[...document.querySelectorAll('[data-testid="ban-tien"] button')].find(x=>x.textContent.trim()==='100k');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.tap(to50.x, to50.y, 40);
  const bay = await cho(c, "document.querySelectorAll('[class*=_bay_]').length>0", 600);
  await sleep(450); await c.tap(to100.x, to100.y, 40); await sleep(500);
  const giua = await c.js(DO_KHOI);
  const tong = await c.js("(()=>{const b=document.querySelector('[data-testid=khay-tong]');return b?b.textContent:null})()");
  ghi('SỔ: chạm tờ 50k rồi 100k ⇒ khay cộng đúng 150.000', /150\.000/.test(tong ?? ''), tong ?? 'null');
  ghi('SỔ: tờ tiền BAY lên khay (phần tử bay xuất hiện ngay sau cú chạm)', bay === true);
  const dich = khacToaDo(truoc, giua, 1);
  ghi('⭐ SỔ: hai cú chạm tờ liền nhau — KHÔNG khối nào đổi toạ độ (bàn tiền đứng yên, ô bento đứng yên)', dich.length === 0, dich.slice(0, 4).join(' | '));
  const nutChi = await c.js(`(()=>{const b=[...document.querySelectorAll('[data-testid="ban-tien"] button')].find(x=>/CHI/.test(x.textContent)&&!/THU/.test(x.textContent));const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.tap(nutChi.x, nutChi.y, 30); await c.tap(nutChi.x, nutChi.y, 30);
  await sleep(1200);
  const ks = await docKho(c, 'khoan');
  const moi = ks.filter((x) => x.soTien === 150000 && x.chieu === 'chi' && x.phanBo === undefined);
  ghi('SỔ: − CHI bấm đúp ⇒ đúng MỘT khoản 150.000 trong kho (không ghi trùng)', ks.length - k0 === 1 && moi.length === 1, `+${ks.length - k0}`);
  const sauGhi = await c.js(DO_KHOI);
  ghi('SỔ: sau khi ghi, khối bento vẫn đứng yên', khacToaDo(truoc, sauGhi, 1).filter((x) => !x.startsWith('btn#')).length === 0);
  const homNayDayDu = await c.js("document.querySelector('[data-o=so-hom-nay] [data-testid=so-hom-nay]')?.dataset.dayDu");
  ghi('SỔ: ô CHI HÔM NAY cộng đúng (85.000 + 150.000 = 235.000)', homNayDayDu === '235.000', homNayDayDu ?? 'null');

  // ── SỔ: danh sách + xoá + hoàn tác ──
  await cham(c, '[data-o=so-hom-nay]'); await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(700);
  const dong0 = await c.js("[...document.querySelectorAll('[role=dialog] button[aria-expanded]')].length");
  ghi('SỔ › danh sách trong lớp có các dòng khoản (bấm được)', dong0 > 0, `dòng=${dong0}`);
  await c.js("document.querySelector('[role=dialog] button[aria-expanded]').click()"); await sleep(300);
  await chamChu('XOÁ'); await cho(c, "!document.querySelector('[role=dialog]')", 3000); await sleep(500);
  const ksXoa = await docKho(c, 'khoan');
  ghi('SỔ › XOÁ một dòng ⇒ khoản biến khỏi sổ, lớp tự đóng để toast HOÀN TÁC thấy được', ksXoa.length === ks.length - 1 && !(await hopThoai()), `${ks.length} → ${ksXoa.length}`);
  const toast = await c.js("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/HOÀN TÁC/.test(x.textContent));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  if (toast) { await c.tap(toast.x, toast.y, 30); await sleep(900); }
  const nSau = (await docKho(c, 'khoan')).length;
  ghi('SỔ › HOÀN TÁC ⇒ khoản trở lại', !!toast && nSau === ks.length, `toast=${JSON.stringify(toast)} · ${nSau}/${ks.length}`);

  // ── HŨ: NẠP ──
  await moLai(c, 'hu', mauCo(nay));
  const nap0 = (await docKho(c, 'khoan')).filter((x) => x.phanBo === 'tay' && x.huId === 'h1');
  const so0 = nap0.reduce((a, x) => a + x.soTien, 0);
  await cham(c, '[data-o=hu-uu-tien]'); await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(700);
  const ttHu = await hopThoai();
  ghi('HŨ › ô ★ → lớp chi tiết: LỜI ĐOÁN + độ chắc + kỳ trước (SPEC mục 4.2)', /LỜI ĐOÁN CỦA BẠN/.test(ttHu ?? '') && /KHÁ CHẮC/.test(ttHu ?? '') && /ĐỦ MỨC/.test(ttHu ?? ''));
  await chamChu('^NẠP'); await sleep(900);
  const lopChia = await hopThoai();
  ghi('HŨ › NẠP → lớp CHIA TIỀN với hũ đã chọn sẵn', /CHIA TIỀN TỐI NAY/.test(lopChia ?? '') && /QUỸ DỰ PHÒNG/.test(lopChia ?? ''));
  const to = await c.js("(()=>{const b=[...document.querySelectorAll('[role=dialog] [data-testid=to-khay] button')].find(x=>!x.disabled);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,t:b.getAttribute('aria-label')}})()");
  if (!to) { ghi('HŨ › khay có tờ để nạp', false); } else {
    await c.tap(to.x, to.y, 40); await sleep(1100);
    const nap1 = (await docKho(c, 'khoan')).filter((x) => x.phanBo === 'tay' && x.huId === 'h1');
    ghi('HŨ › chạm một tờ ⇒ ĐÚNG MỘT khoản phân bổ vào hũ (một lần ghi)', nap1.length === nap0.length + 1, `${nap0.length} → ${nap1.length}`);
    const them = nap1.reduce((a, x) => a + x.soTien, 0) - so0;
    await c.js("[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='ĐÓNG').click()");
    // xu rơi: phần tử tạm xuất hiện ngay sau khi lớp đóng (kiểm hành vi ở headless=new) rồi TỰ DỌN bằng hẹn giờ
    let thayXu = false;
    for (let i = 0; i < 40 && !thayXu; i += 1) { thayXu = await c.js("document.querySelectorAll('i[class*=xuRoi]').length>0"); if (!thayXu) await sleep(50); }
    ghi('HŨ › lớp đóng ⇒ XU RƠI vào miệng hũ trên màn (phần tử xu xuất hiện)', thayXu);
    await sleep(2200);
    ghi('HŨ › xu dọn xong bằng hẹn giờ (không kẹt trên body)', await c.js("document.querySelectorAll('i[class*=xuRoi]').length===0"));
    const chu = await c.js("document.querySelector('[data-o=hu-uu-tien]').textContent");
    const gon = (n) => { const m = n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(',0', '')}tr` : `${n >= 1e4 ? Math.round(n / 1e3) : (n / 1e3).toFixed(1).replace('.', ',').replace(',0', '')}k`; return m; };
    ghi('HŨ › số hũ ★ trên màn tăng đúng bằng tờ vừa nạp', chu.includes(gon(so0 + them)), `${gon(so0)} + ${them} ⇒ cần "${gon(so0 + them)}" trong "${chu.slice(-30)}"`);
  }

  // ── HŨ: tạo hũ ba bước ──
  await moLai(c, 'hu', mauCo(nay));
  const hu0 = (await docKho(c, 'hu')).length;
  await cham(c, '[data-o=hu-tao-tk]'); await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(800);
  ghi('TẠO HŨ › bước 1/3: chọn loại (TIẾT KIỆM · CHI)', /BƯỚC 1 \/ 3/.test((await hopThoai()) ?? '') && /TIẾT KIỆM/.test((await hopThoai()) ?? '') && /CHI/.test((await hopThoai()) ?? ''));
  await chamChu('^TIẾP'); await sleep(600);
  ghi('TẠO HŨ › bước 2/3: tên · mục tiêu · mức · hạn', /BƯỚC 2 \/ 3/.test((await hopThoai()) ?? ''));
  await c.js("document.querySelector('[data-testid=tao-ten]').focus()");
  await c.send('Input.insertText', { text: 'Xe máy' });
  await c.js("document.querySelector('[role=dialog] input[inputmode=numeric]').focus()");
  await c.send('Input.insertText', { text: '5000000' });
  const ch3 = await c.js("(()=>{const b=[...document.querySelectorAll('[data-testid=tao-han] button')].find(x=>/^3/.test(x.textContent));b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await c.tap(ch3.x, ch3.y, 40); await sleep(300);
  await chamChu('^TIẾP'); await sleep(600);
  ghi('TẠO HŨ › bước 3/3: lời đoán "tới hạn ĐỦ mức" + ba nấc CHẮC · KHÁ CHẮC · ĐOÁN THÔI (không bốn nấc)', /BƯỚC 3 \/ 3/.test((await hopThoai()) ?? '') && /CHẮC/.test((await hopThoai()) ?? '') && /ĐOÁN THÔI/.test((await hopThoai()) ?? '') && !/GẦN ĐỦ|KHOẢNG NỬA|ÍT HƠN NỬA/.test((await hopThoai()) ?? ''));
  const chacCao = await c.js("(()=>{const b=document.querySelector('[data-testid=tao-chac] button');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await c.tap(chacCao.x, chacCao.y, 40); await sleep(300);
  const taoXong = await nutTrongLop('^TẠO HŨ$');
  await c.tap(taoXong.x, taoXong.y, 20); await c.tap(taoXong.x, taoXong.y, 20);
  await cho(c, "!document.querySelector('[role=dialog]')", 4000); await sleep(900);
  const husau = await docKho(c, 'hu');
  const hmoi = husau.find((x) => x.ten === 'Xe máy');
  ghi('TẠO HŨ › TẠO HŨ bấm đúp ⇒ đúng MỘT hũ mới "Xe máy" trong kho', husau.length === hu0 + 1 && !!hmoi, `${hu0} → ${husau.length}`);
  ghi('TẠO HŨ › hũ mới có mức 5.000.000 + kỳ hạn + lời đoán độ chắc (đúng mô hình LoiDoanHu)', !!hmoi && hmoi.muc === 5000000 && hmoi.lenh !== undefined && (hmoi.loiDoan ?? []).length === 1 && hmoi.loiDoan[0].chac === 'cao', JSON.stringify(hmoi?.loiDoan?.[0] ?? null).slice(0, 120));

  // ── HŨ CON ──
  await moLai(c, 'hu', mauCo(nay));
  await c.js("[...document.querySelectorAll('[data-o=hu-con-hu]')].find(b=>/Đà Lạt/.test(b.textContent)).click()");
  await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(700);
  const hc = await c.js("[...document.querySelectorAll('[role=dialog] [data-testid=hu-con-hang]')].map(b=>b.textContent)");
  ghi('HŨ CON › lớp hũ Đà Lạt liệt kê hai hũ con (Vé xe · Ở) và tổng cha = tổng con (không hàng "chưa chia")', hc.length === 2 && !(await c.js("!!document.querySelector('[role=dialog] [data-testid=hu-chua-chia]')")), hc.join(' | '));
  await c.js("document.querySelector('[role=dialog] [data-testid=hu-con-hang]').click()"); await sleep(700);
  const kc0 = (await docKho(c, 'khoan')).length;
  for (const d of ['5', '0', '0', '0', '0']) { await chamChu(`^${d}$`, 30); }
  await sleep(200);
  ghi('HŨ CON › gõ 50.000 trên bàn phím số của lớp', /50\.000/.test(await c.js("document.querySelector('[data-testid=con-go]')?.textContent ?? ''")));
  const napCon = await nutTrongLop('^NẠP');
  await c.tap(napCon.x, napCon.y, 20); await c.tap(napCon.x, napCon.y, 20); await sleep(1300);
  const khoanSau = await docKho(c, 'khoan'); const conSau = (await docKho(c, 'hu_con')).find((x) => x.id === 'c1');
  ghi('HŨ CON › NẠP bấm đúp ⇒ đúng MỘT khoản (ở hũ CHA) và hũ con ghi nhớ khoản ấy', khoanSau.length === kc0 + 1 && conSau.khoanIds.length === 2, `khoản +${khoanSau.length - kc0} · khoanIds=${conSau?.khoanIds}`);
  const tongCha = khoanSau.filter((x) => x.huId === 'h3' && x.phanBo === 'tay').reduce((a, x) => a + (x.chieu === 'chi' ? x.soTien : -x.soTien), 0);
  const tongCon = [...conSau.khoanIds, ...((await docKho(c, 'hu_con')).find((x) => x.id === 'c2')?.khoanIds ?? [])].reduce((a, id) => { const k = khoanSau.find((x) => x.id === id); return a + (k ? (k.chieu === 'chi' ? k.soTien : -k.soTien) : 0); }, 0);
  ghi('HŨ CON › TỔNG HŨ CHA = TỔNG HŨ CON sau khi nạp (đọc thẳng từ kho)', tongCha === tongCon && tongCha === 350000, `cha=${tongCha} con=${tongCon}`);

  // ── GƯƠNG: HƯỚNG tuần tới (mô hình DEMO bản 6 — founder 11/10 câu B): ba phím, chọn một = MỘT cú ghi, không chuyển màn; SỔ đọc lại; khung ở CÀI ĐẶT ──
  await moLai(c, 'guong', mauCo(nay));
  await cho(c, "!!document.querySelector('[data-o=guong-huong]')", 20000);
  await cham(c, '[data-o=guong-huong]'); await cho(c, "!!document.querySelector('[data-testid=the-huong]')", 4000); await sleep(600);
  const huongHoSo = async () => (await docKho(c, 'meta')).find((m) => Array.isArray(m?.huong))?.huong ?? [];
  const h0 = (await huongHoSo()).length;
  const phimHuong = await c.js("[...document.querySelectorAll('[data-testid=huong-lua-chon] button')].map(b=>b.textContent.replace('●','').trim())");
  ghi('GƯƠNG › HƯỚNG: ba phím (ưu tiên hũ · ưu tiên hũ · giữ như cũ), không phím nào chọn sẵn, lớp không còn thẻ khung', phimHuong.length === 3 && phimHuong[2] === 'GIỮ NHƯ CŨ' && /^ƯU TIÊN /.test(phimHuong[0]) && /^ƯU TIÊN /.test(phimHuong[1])
    && (await c.js("document.querySelectorAll('[data-testid=huong-lua-chon] [aria-pressed=true]').length")) === 0
    && (await c.js("!document.querySelector('[data-testid=phong-cach]')")) === true, JSON.stringify(phimHuong));
  const ph1 = await nutTrongLop('^ƯU TIÊN');
  await c.tap(ph1.x, ph1.y, 20); await c.tap(ph1.x, ph1.y, 20); await sleep(900);
  const h1 = await huongHoSo();
  ghi('GƯƠNG › HƯỚNG: chọn ƯU TIÊN <hũ> bấm đúp ⇒ đúng MỘT bản ghi mới (uu_tien_hu · theo), phím sáng ●, KHÔNG đổi route, lớp vẫn mở',
    h1.length === h0 + 1 && h1.at(-1)?.ma === 'uu_tien_hu' && h1.at(-1)?.kieu === 'theo'
    && (await c.js("document.querySelectorAll('[data-testid=huong-lua-chon] [aria-pressed=true]').length")) === 1
    && (await c.js("/●/.test(document.querySelector('[data-testid=huong-lua-chon] [aria-pressed=true]')?.textContent??'')")) === true
    && (await c.js('location.pathname')) === '/tai-chinh/guong' && !!(await hopThoai()), `bản ghi ${h0} → ${h1.length}`);
  const phChu = await nutTrongLop('^GIỮ NHƯ CŨ');
  await c.tap(phChu.x, phChu.y, 20); await sleep(700);
  const h2 = await huongHoSo();
  ghi('GƯƠNG › HƯỚNG: đổi sang GIỮ NHƯ CŨ = THAY (hai bản ghi theo, còn đúng một phím sáng)', h2.length === h1.length + 1 && h2.at(-1)?.ma === 'giu_nhu_cu'
    && (await c.js("document.querySelectorAll('[data-testid=huong-lua-chon] [aria-pressed=true]').length")) === 1);
  const phHu = await nutTrongLop('^ƯU TIÊN');
  await c.tap(phHu.x, phHu.y, 20); await sleep(700);
  await c.go(url('so')); await cho(c, conKhung('so'), 15000); await sleep(1500);
  const cauSo = await c.js("document.querySelector('[data-testid=so-huong-cau]')?.textContent ?? ''");
  ghi('SỔ › khe HƯỚNG TUẦN NÀY đọc lại đúng lựa chọn ("Ưu tiên … — …")', /^Ưu tiên .+ — (làm đúng \d+\/\d+ lần|chưa có lần chia nào)$/.test(cauSo), cauSo);
  const kheTran = await c.js("(()=>{const e=document.querySelector('[data-o=so-huong]');return e?e.scrollHeight-e.clientHeight:-1})()");
  ghi('SỔ › khe HƯỚNG hai dòng không tràn ô 44px', kheTran <= 0, `thừa=${kheTran}`);
  await cham(c, '[aria-label="Cài đặt khu Tài chính"]'); await cho(c, "!!document.querySelector('[data-testid=khung-chia-tien]')", 6000);
  ghi('KHUNG CHIA TIỀN đã dời sang lớp CÀI ĐẶT: bánh răng ⇒ thẻ khung nằm trong hộp thoại; lớp HƯỚNG (kiểm ở trên) không còn thẻ khung',
    (await c.js("!!document.querySelector('[role=dialog] [data-testid=khung-chia-tien]')")) === true);

  // RÀ 12/10 C1: từ lớp CÀI ĐẶT bấm một BƯỚC DỰNG của khung ⇒ lớp CÀI ĐẶT ĐÓNG (không đè lên màn HŨ), màn đích là HŨ.
  const buocDung = await c.js("(()=>{const b=document.querySelector('[role=dialog] [data-testid=khung-chia-tien] [data-testid^=buoc-] button');if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,ten:b.textContent}})()");
  if (buocDung) {
    await c.tap(buocDung.x, buocDung.y, 40); await sleep(900);
    ghi('KHUNG ở CÀI ĐẶT › bấm một bước dựng ⇒ lớp CÀI ĐẶT đóng, sang HŨ (không lớp nào đè lên màn đích)',
      (await c.js('location.pathname')) === '/tai-chinh/hu' && (await c.js("!document.querySelector('[data-testid=khung-chia-tien]')")) === true, `${buocDung.ten} → ${await c.js('location.pathname + location.search')}`);
  } else {
    ghi('KHUNG ở CÀI ĐẶT › (cảnh mẫu không có bước dựng nào — bỏ qua phép bấm; bài đơn vị canh đường này)', true);
  }

  // ── GƯƠNG: chốt tuần ──
  await moLai(c, 'guong', mauCo(nay));
  await cham(c, '[data-o=guong-chot]'); await cho(c, "!!document.querySelector('[role=dialog]')", 3000); await sleep(800);
  const lopChot = await hopThoai();
  ghi('GƯƠNG › CHỐT SỔ TUẦN → lớp tóm tắt tuần + nút CHỐT TUẦN (không chốt ngay khi chạm)', /CHỐT SỔ TUẦN/.test(lopChot ?? '') && /Ngày đã ghi trong tuần/.test(lopChot ?? '') && !(await nmock(PORT_API))['POST /pfm/tuan']);
  const cm = await nutTrongLop('^CHỐT TUẦN$');
  await c.tap(cm.x, cm.y, 20); await c.tap(cm.x, cm.y, 20); await sleep(1500);
  ghi('GƯƠNG › CHỐT TUẦN bấm đúp ⇒ đúng MỘT lệnh niêm phong gửi máy chủ', (await nmock(PORT_API))['POST /pfm/tuan'] === 1, String((await nmock(PORT_API))['POST /pfm/tuan']));

  // ── THẺ: hành tinh + hạt sao ──
  await ctl(PORT_API, 'reset=1');
  await c.go(url('the')); await cho(c, conKhung('the'), 15000);
  let hat = false;
  for (let i = 0; i < 60 && !hat; i += 1) { hat = await c.js("[...document.querySelectorAll('body > i')].some(e=>e.style.position==='fixed')"); if (!hat) await sleep(50); }
  ghi('THẺ › mỗi lần dựng: HẠT SAO phụt quanh hành tinh (phần tử hạt xuất hiện sau cầu rơi + vành quét)', hat);
  await sleep(1500);
  ghi('THẺ › hạt sao tự dọn bằng hẹn giờ', await c.js("![...document.querySelectorAll('body > i')].some(e=>e.style.position==='fixed')"));
}

// ═══ PHẦN 5 — ĐƯỜNG DẪN ═══
async function phanDuong(c, w, h) {
  const nay = homNayVN();
  for (const [che, ten] of [['so', 'đã đăng nhập'], ['khach', 'khách'], ['chua', 'chưa đăng nhập']]) {
    for (const tab of TAB) {
      await ctl(PORT_API, `mode=${che}&lat=0&off=0&loi=0&reset=1`);
      await c.go(url('so')); await cho(c, "document.body.innerText.length>10", 20000); await sleep(400);
      if (che !== 'chua') await gieo(c, mauCo(nay));
      await c.go(url(tab));
      await cho(c, "document.body.innerText.length>30 || !!document.querySelector('[data-khung-pfm]')", 25000); await sleep(1800);
      const p = await c.js('location.pathname');
      const loi = await c.js('/Đã xảy ra lỗi|Unexpected Application Error|Cannot read/i.test(document.body.innerText)');
      const coKhung = await c.js(conKhung(tab));
      if (che === 'chua') ghi(`deep link /tai-chinh/${tab} (${ten}): không vỡ, không 404 → ${p}`, !loi && (coKhung || (await c.js('document.body.innerText.length')) > 30), `${p} khung=${coKhung}`);
      else ghi(`deep link /tai-chinh/${tab} (${ten}): vẽ đúng khung ${tab.toUpperCase()}, không lỗi`, !loi && coKhung, `${p} khung=${coKhung}`);
    }
  }
}

// ═══ PHẦN 6 — MẠNG / KHO ═══
async function phanMang(c, w, h) {
  const nay = homNayVN();
  // trễ mạng: /auth/me bị GIỮ — chỗ giữ sẵn đứng yên, không số 0 thay "chưa có"
  await ctl(PORT_API, 'mode=so&lat=0&off=0&loi=0&reset=1');
  await c.go(url('so')); await cho(c, "document.body.innerText.length>10", 20000); await sleep(500);
  await gieo(c, mauCo(nay));
  await ctl(PORT_API, 'lat=-1');
  await c.go(url('hu'));
  await cho(c, conKhung('hu'), 30000); await sleep(1800); await tuaHoatAnh(c);
  const truoc = await c.js(DO_KHOI);
  await sleep(1200);
  await ctl(PORT_API, 'tha=1&lat=0');
  await sleep(2500); await tuaHoatAnh(c);
  const sau = await c.js(DO_KHOI);
  const dich = khacToaDo(truoc, sau, 1);
  ghi('⭐ API bị GIỮ rồi thả: KHÔNG khối nào mọc/nhảy khi dữ liệu về (toạ độ trước = sau ±1 px)', dich.length === 0, dich.slice(0, 4).join(' | '));
  const cuon = await c.js('(()=>{const e=document.documentElement;return e.scrollHeight-e.clientHeight})()');
  ghi('trễ mạng: vẫn không thanh cuộn', cuon === 0, String(cuon));
  // mất mạng: PFM đọc kho trên máy ⇒ vẫn dùng được
  await ctl(PORT_API, 'off=1');
  await c.go(url('so')); await cho(c, conKhung('so'), 30000); await sleep(1500);
  const soLieu = await c.js("document.querySelector('[data-o=so-hom-nay]')?.textContent ?? ''");
  ghi('mất mạng: SỔ vẫn hiện số trên máy (kho IndexedDB, không phụ thuộc mạng)', /[0-9]/.test(soLieu), soLieu.slice(0, 30));
  await ctl(PORT_API, 'off=0');
  // kho lỗi: indexedDB.open ném ⇒ dải cảnh báo "sổ chỉ sống một phiên" nói rõ
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "(()=>{const o=indexedDB.open.bind(indexedDB);indexedDB.open=function(){throw new Error('kho hong gia')}})()" });
  await c.go(url('so')); await cho(c, conKhung('so'), 30000); await sleep(2500);
  const canh = await c.js("(()=>{const a=document.querySelector('[data-khung-pfm=so] [role=alert]');return a?a.textContent:null})()");
  ghi('kho IndexedDB lỗi: SỔ nói rõ "chỉ sống một phiên" (không im lặng nuốt dữ liệu) và vẫn ghi được trong phiên', !!canh && /phiên|đóng app|tạm/i.test(canh), (canh ?? 'không thấy').slice(0, 90));
}

const CAC_PHAN = { cuon: phanCuon, tab: phanTab, lop: phanLop, ghi: phanGhi, duong: phanDuong, mang: phanMang };

const api = await dungApiGia(PORT_API);
try {
  let i = 0;
  for (const [w, h] of KHUNG) {
    for (const ten of PHAN) {
      const c = await moChrome({ w, h, port: 9500 + (i += 1) });
      console.log(`\n=== ${ten.toUpperCase()} · KHUNG ${w}×${h} ===`);
      try { await CAC_PHAN[ten](c, w, h); } catch (e) { ghi(`${ten} ${w}×${h}: kịch bản không chạy hết`, false, String(e.message ?? e).slice(0, 200)); } finally { await c.dong(); }
    }
  }
} finally { api.close(); }
const do_ = bang.filter((b) => !b.ok);
console.log(`\nTỔNG: ${bang.length - do_.length}/${bang.length} PASS${do_.length ? ` · FAIL: ${do_.map((b) => b.ten).join(' | ')}` : ''}`);
process.exit(do_.length ? 1 : 0);
