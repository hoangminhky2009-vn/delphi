/**
 * Trang admin TỐI GIẢN — server-render một chuỗi HTML tĩnh từ API (GĐ4 VIỆC 1).
 * KHÔNG phải UI sản phẩm (GĐ5, Terminal×Neon, ở web/ — cửa sổ khác làm);
 * đây là công cụ nội bộ: form thô + fetch JSON cùng origin (cookie phiên admin).
 * Không CDN, không build step — một file, đổi hosting vẫn chạy (A8.9).
 */
export const ADMIN_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DELPHI — Admin</title>
<style>
  body{font-family:ui-monospace,Consolas,monospace;max-width:860px;margin:24px auto;padding:0 12px;background:#0b0e14;color:#d8dee9}
  h1,h2{color:#88c0d0}fieldset{border:1px solid #3b4252;margin:16px 0;padding:12px}
  label{display:block;margin:6px 0 2px}input,select,textarea{width:100%;box-sizing:border-box;background:#151a23;color:#d8dee9;border:1px solid #3b4252;padding:6px}
  button{background:#1f2937;color:#a3be8c;border:1px solid #a3be8c;padding:8px 14px;margin-top:10px;cursor:pointer}
  button.danger{color:#bf616a;border-color:#bf616a}
  pre{background:#151a23;padding:10px;overflow-x:auto;border:1px solid #3b4252;white-space:pre-wrap}
  table{border-collapse:collapse;width:100%}td,th{border:1px solid #3b4252;padding:6px;text-align:left}
  .opt-row{display:flex;gap:6px}.opt-row input{flex:1}
</style>
</head>
<body>
<h1>DELPHI — Admin</h1>
<p>Mọi thao tác ghi <code>admin_audit</code>. Giờ nhập theo máy bạn, lưu UTC.</p>

<!--
  D335 (15/09): trang này CHỈ còn xác thực và quản trị cấp cao — mã hai lớp · quyền quản trị · mở/chốt/huỷ kèo
  (ba thao tác chuyển token, không hoàn tác). Phân tích, kinh tế, tạo kèo nháp, kho dữ liệu đã gom về app quản trị
  riêng /quan-tri. Trang này là máy chủ vẽ nên vẫn sống khi bản build web hỏng — đúng vai đường thoát (§8.1).
-->
<p style="border:1px solid #88c0d0;padding:10px">Phân tích · kinh tế · tạo kèo nháp · kho dữ liệu đã gom về
<a href="/quan-tri" style="color:#88c0d0"><b>app quản trị /quan-tri ›</b></a> — mở khoá mã hai lớp ở dưới trước.</p>

<!--
  KHOÁ HAI LỚP (0025). Khối này phải nằm ĐẦU TIÊN và phải TỰ TẢI: không có nó
  thì endpoint ghi danh tồn tại mà không có cửa nào bấm vào được — tức khoá
  admin ra ngoài bằng chính cái khoá vừa lắp.
-->
<fieldset id="tfa-box"><legend><h2>🔐 MÃ HAI LỚP</h2></legend>
  <div id="tfa">(đang kiểm…)</div>
  <pre id="tfa_out"></pre>
</fieldset>

<fieldset id="quyen-box"><legend><h2>👥 NGƯỜI CÓ QUYỀN QUẢN TRỊ</h2></legend>
  <button onclick="loadQuyen()">↻ Tải danh sách</button>
  <div id="quyen">(bấm để tải)</div>
  <hr>
  <p style="color:#7b8494">Uỷ quyền = trao <b>đúng quyền như bạn</b>, kể cả resolve/huỷ kèo
  (chuyển token của người chơi). Người được trao tự bật mã hai lớp ở lần đăng nhập đầu.
  <b>Bấm "uỷ quyền »" ở bảng trên là xong</b> — ô dưới chỉ dùng khi người cần trao
  không nằm trong danh sách gần đây.</p>
  <label>hoặc gõ handle</label><input id="q_handle" placeholder="vd: judy">
  <button onclick="doiQuyen(true)">UỶ QUYỀN »</button>
  <button onclick="doiQuyen(false)">THU QUYỀN</button>
  <pre id="quyen_out"></pre>
</fieldset>

<!--
  SUẤT TRẬN (SPEC tran-tran-ngay mục 4.3) — hai nửa số: cổng Worker (/api/v1/_suat — hàng chờ, quỹ giờ) và DB
  (/api/v1/admin/suat-tran — lưới trần ngày). Hai nguồn lệch nhau là tín hiệu: cổng tắt/hỏng thì chỉ còn lưới chặn.
-->
<fieldset id="suat-box"><legend><h2>⏳ SUẤT TRẬN</h2></legend>
  <button onclick="loadSuat()">↻ Tải số suất trận</button>
  <pre id="suat">(bấm để tải)</pre>
</fieldset>

<fieldset id="todo-box"><legend><h2>▶ VIỆC CẦN LÀM</h2></legend>
  <button onclick="loadTodo()">↻ Tải việc cần làm</button>
  <div id="todo">(bấm để tải)</div>
</fieldset>

<fieldset><legend><h2>Thao tác thủ công (dự phòng)</h2></legend>
  <p style="color:#7b8494">Bình thường dùng "VIỆC CẦN LÀM" ở trên. Mục này để xử lý
  ngoại lệ: hủy kèo, hoặc chốt một kèo bất kỳ.
  <b>Không phải nhớ hay gõ market_id</b> — bấm "Tải danh sách", rồi bấm « chọn » ở
  dòng kèo, ô bên dưới tự điền.</p>
  <button onclick="loadMarkets()">Tải danh sách</button>
  <div id="mkts"><p style="color:#7b8494">(bấm "Tải danh sách" — mỗi dòng có nút
  « chọn » để tự điền market_id bên dưới)</p></div>
  <h3>Thao tác theo market_id</h3>
  <label>market_id (tự điền khi bấm « chọn » ở danh sách trên — không cần gõ tay)</label><input id="a_mid">
  <button onclick="openMarket()">MỞ kèo (draft → open, rút seed Kho bạc)</button>
  <button onclick="loadOptions()">① XEM CÁC CỬA (lấy option_id)</button>
  <div id="a_opts"></div>
  <label>outcome_option_id (cửa thắng — bấm nút "chọn" ở trên cho nhanh)</label><input id="a_oid">
  <button onclick="previewResolve()">PREVIEW resolve (lấy mã xác nhận)</button>
  <label>Mã xác nhận (gõ lại từ preview)</label><input id="a_code">
  <label>URL bằng chứng nguồn công bố</label><input id="a_ev">
  <label>Ghi chú resolve (số liệu nguồn)</label><input id="a_note">
  <button onclick="commitResolve()">RESOLVE — CHUNG THẨM (A3.2)</button>
  <label>Lý do hủy (bắt buộc nếu hủy)</label><input id="a_reason">
  <button class="danger" onclick="cancelMarket()">HỦY kèo — hoàn 100%</button>
  <pre id="a_out"></pre>
</fieldset>

<script>
const $=id=>document.getElementById(id);
const show=(id,x)=>{$(id).textContent=typeof x==='string'?x:JSON.stringify(x,null,2)};
async function api(path,opts){
  const r=await fetch(path,Object.assign({headers:{'content-type':'application/json'}},opts));
  const b=await r.json().catch(()=>({}));return {status:r.status,body:b};
}
const iso=v=>v?new Date(v).toISOString():'';
// D444 (28/09): review bảo mật prod bắt 4 chỗ ghép dữ liệu server (question_text,
// label, status) thẳng vào innerHTML mà KHÔNG qua esc() — admin tự XSS chính
// mình nếu người tạo kèo/option gõ HTML vào câu hỏi. Đã bọc esc() ở cả 4 chỗ
// (loadMarkets, loadOptions); bài canh: tests/admin_ui_thoat_chu.test.ts.
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtT=n=>Number(n).toLocaleString('vi-VN')+' T';
// Mốc thời gian ĐỦ giờ:phút, ghim múi giờ Việt Nam (A8.8: lưu UTC, HIỆN +07).
// Ghim chứ không để trình duyệt tự chọn: trang này là công cụ quản trị, hai
// người ở hai máy đọc cùng một dòng phải ra cùng một giờ, nếu không thì lúc
// đối chiếu sự cố sẽ cãi nhau về một chênh lệch không có thật.
const gioVN=v=>v?new Date(v).toLocaleString('vi-VN',
  {timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
   hour:'2-digit',minute:'2-digit',hour12:false}):'—';

// ===================== SUẤT TRẬN (SPEC tran-tran-ngay) =====================
// textContent, không innerHTML: chỉ số, nhưng không có lý do mở cửa XSS cho một khối mới (D444).
async function loadSuat(){
  const [cong,db]=await Promise.all([api('/api/v1/_suat'),api('/api/v1/admin/suat-tran')]);
  const c=cong.body||{},d=db.body||{};
  const dongCong=c.cong==='bat'
    ?'Cổng: trận giờ này '+c.dung_gio_nay+' / quỹ giờ '+c.quy_gio+' · còn nhả được '+c.con_lai
      +' · hôm nay '+c.da_dung+' / quỹ ngày '+c.quy_ngay+' · đang chờ '+c.dang_cho+' · đang giữ '+c.dang_giu
    :'Cổng: '+(cong.status===404?'không có Worker (local)':(c.cong||('lỗi '+esc(cong.status))))+' — chỉ còn lưới server chặn';
  const dongDb=db.status===200
    ?'DB: trận người thường giờ này '+d.tran_gio_nay+' · hôm nay '+d.tran_hom_nay+' / lưới '+d.tran_ngay_server
      +' (quỹ cổng '+d.quy_ngay+') · giờ VN '+d.gio_vn+'h'
    :'DB: lỗi '+esc(db.status);
  show('suat',dongCong+'\\n'+dongDb);
}

// ===================== MÃ HAI LỚP (0025) =====================
// Ba trạng thái, ba giao diện khác nhau. Cố ý KHÔNG gộp: "chưa bật" và "hết
// hạn" trông giống nhau (đều bị chặn) nhưng cách thoát khác hẳn nhau.
async function loadTfa(){
  const r=await api('/api/v1/admin/2fa/trang-thai');
  if(r.status!==200){$('tfa').innerHTML='<p style="color:#bf616a">Không đọc được trạng thái. Bạn có phải admin không?</p>';return}
  const s=r.body;
  if(!s.da_ghi_danh){
    $('tfa').innerHTML='<p style="color:#ebcb8b">● CHƯA BẬT — mọi cửa quản trị đang đóng.</p>'+
      '<button onclick="tfaGhiDanh()">BẮT ĐẦU BẬT MÃ HAI LỚP »</button>'+
      '<div id="tfa_dk"></div>';
    return;
  }
  if(!s.quyen_con_han){
    $('tfa').innerHTML='<p style="color:#ebcb8b">● ĐÃ BẬT — nhập mã để mở quyền quản trị ('+s.ttl_phut+' phút).</p>'+
      '<label>Mã 6 số</label><input id="tfa_ma" inputmode="numeric" autocomplete="one-time-code" placeholder="000000">'+
      '<button onclick="tfaGoi(\\'mo-khoa\\')">MỞ QUYỀN »</button>';
    return;
  }
  $('tfa').innerHTML='<p style="color:#a3be8c">✔ Quyền quản trị đang mở.</p>'+
    '<p style="color:#7b8494">Thao tác không hoàn tác được (mở kèo có seed · resolve · huỷ · trao vật phẩm) '+
    'cần nhập mã LẦN NỮA, hiệu lực '+s.xac_thuc_lai_phut+' phút.</p>'+
    (s.xac_thuc_lai_con_han?'<p style="color:#a3be8c">✔ Đang trong cửa sổ xác thực lại.</p>':'')+
    '<label>Mã 6 số (xác thực lại)</label><input id="tfa_ma" inputmode="numeric" autocomplete="one-time-code" placeholder="000000">'+
    '<button onclick="tfaGoi(\\'xac-thuc-lai\\')">XÁC THỰC LẠI »</button>';
}
/*
 * ⚠ HANDLE ĐI BẰNG data-*, KHÔNG NHÉT VÀO onclick.
 * Bản đầu dựng onclick="quyenNhanh(...)" và phải tự thoát dấu nháy đơn — mà hàm
 * esc sẵn có (dòng ~110) CỐ Ý không thoát dấu nháy đơn, nên một handle chứa nó
 * là thoát ra khỏi chuỗi. Sửa bằng cách bỏ hẳn đường đó: thuộc tính data chỉ
 * cần thoát dấu nháy kép (đúng thứ esc làm), và một listener uỷ nhiệm đọc ra.
 *
 * ⚠⚠ VÀ TUYỆT ĐỐI KHÔNG DÙNG DẤU BACKTICK Ở BẤT KỲ ĐÂU TRONG TỆP NÀY, kể cả
 * trong chú thích: cả trang là MỘT template literal, nên một backtick đóng chuỗi
 * và làm hỏng toàn bộ tệp. Đã dính hai lần khi viết D208.
 */
document.addEventListener('click',function(e){
  const b=e.target.closest&&e.target.closest('[data-quyen]');
  if(!b)return;
  $('q_handle').value=b.getAttribute('data-quyen');
  doiQuyen(b.getAttribute('data-cho')==='1');
});
async function loadQuyen(){
  const r=await api('/api/v1/admin/quyen');
  if(r.status!==200){show('quyen',r.body);return}
  const ds=r.body.admin||[], uv=r.body.ung_vien||[];
  var h='<table><tr><th>handle</th><th>vai</th><th>2FA</th><th>thao tác</th><th></th></tr>'+
    ds.map(function(a){
      return '<tr><td>'+esc(a.handle)+(a.la_toi?' <b>(bạn)</b>':'')+'</td>'+
        '<td>'+(a.chu_so_huu?'CHỦ SỞ HỮU':'admin')+'</td>'+
        '<td>'+(a.da_ghi_danh_2fa?'✓':'<span style="color:#ebcb8b">chưa</span>')+'</td>'+
        '<td>'+a.so_thao_tac+'</td><td>'+
        // Chủ sở hữu không có nút thu — cửa đó đóng ở máy chủ, nên đừng bày nút
        // rồi để nó trả 409. Nút bấm được mà luôn từ chối thì tệ hơn không có nút.
        (a.chu_so_huu?'<span style="color:#7b8494">—</span>'
          :'<button data-quyen="'+esc(a.handle)+'" data-cho="0">thu</button>')+
        '</td></tr>';
    }).join('')+'</table>';
  h+='<p style="color:#7b8494;margin:14px 0 6px">Tài khoản gần đây — bấm để uỷ quyền ngay:</p>';
  h+= uv.length===0 ? '<p style="color:#7b8494">(không có tài khoản nào đủ điều kiện)</p>'
    : '<table><tr><th>handle</th><th>tạo lúc (giờ VN)</th><th>trận</th><th></th></tr>'+
      uv.map(function(u){
        return '<tr><td>'+esc(u.handle)+'</td><td>'+esc(gioVN(u.tao))+'</td><td>'+u.tran+'</td>'+
          '<td><button data-quyen="'+esc(u.handle)+'" data-cho="1">uỷ quyền »</button></td></tr>';
      }).join('')+'</table>';
  $('quyen').innerHTML=h;
}
async function doiQuyen(cho){
  const h=$('q_handle').value.trim();
  if(!h){show('quyen_out',{error:'nhập handle đã'});return}
  // Hỏi lại BẰNG CHỮ, không phải confirm() trống — người bấm phải đọc ra hậu quả.
  // ⚠ Xuống dòng trong chuỗi dưới phải viết BACKSLASH-BACKSLASH-n. Cả khối này
  // là một template literal, nên một backslash đơn là chèn XUỐNG DÒNG THẬT vào
  // giữa một chuỗi JS — chuỗi không đóng, trang /admin chết trắng. tsc không
  // thấy: với nó đây chỉ là một chuỗi. Đã dính đúng lỗi này khi viết D208;
  // Thứ bắt được là admin_2fa.test.ts §IX — nó lấy HTML đã phục vụ thật qua
  // goi('/admin') rồi parse khối script. (Trỏ vào "npm run lint:admin-ui" là
  // sai: script đó đã gỡ ở D208 vì trùng vai với bài trên và yếu hơn.)
  if(!confirm((cho?'UỶ QUYỀN cho ':'THU QUYỀN của ')+h+'?\\n\\n'+
      (cho?'Họ sẽ làm được MỌI thứ bạn làm được, kể cả resolve và huỷ kèo.'
         :'Họ sẽ mất toàn bộ quyền quản trị.'))) return;
  const r=await api('/api/v1/admin/quyen',{method:'POST',body:JSON.stringify({handle:h,cho:cho})});
  show('quyen_out',r.body);
  if(r.status===200){$('q_handle').value='';loadQuyen()}
}
async function tfaGhiDanh(){
  const r=await api('/api/v1/admin/2fa/ghi-danh',{method:'POST'});
  if(r.status!==200){show('tfa_out',r.body);return}
  // Không dựng mã QR: thêm một thư viện vào đúng cửa admin để tiết kiệm một cú
  // dán tay là đánh đổi sai. Mọi app xác thực đều nhận nhập tay.
  $('tfa_dk').innerHTML='<p>Mở app xác thực (Google Authenticator, Aegis, 1Password…) → thêm tài khoản → NHẬP KHOÁ THỦ CÔNG:</p>'+
    '<pre style="font-size:18px;letter-spacing:2px">'+esc(r.body.bi_mat)+'</pre>'+
    '<p style="color:#7b8494">Hoặc mở liên kết này trên điện thoại: <code>'+esc(r.body.uri)+'</code></p>'+
    '<label>Nhập mã 6 số app hiện ra để XÁC NHẬN</label>'+
    '<input id="tfa_ma" inputmode="numeric" autocomplete="one-time-code" placeholder="000000">'+
    '<button onclick="tfaGoi(\\'xac-nhan\\')">XÁC NHẬN BẬT »</button>';
}
async function tfaGoi(duong){
  const ma=($('tfa_ma')||{}).value||'';
  const r=await api('/api/v1/admin/2fa/'+duong,{method:'POST',body:JSON.stringify({ma:ma})});
  show('tfa_out',r.body);
  await loadTfa();
}
loadTfa();

// ===================== VIỆC CẦN LÀM (đường chính, không gõ gì) =====================
let TODO=[];
async function loadTodo(){
  const r=await api('/api/v1/admin/pending');
  if(r.status!==200){show('todo',r.body);return}
  TODO=r.body.markets||[];
  if(!TODO.length){$('todo').innerHTML='<p>✔ Không có việc nào. Kèo đang mở cứ để chạy.</p>';return}
  $('todo').innerHTML=TODO.map((m,i)=>{
    if(m.status==='draft'){
      return '<div style="border:1px solid #3b4252;padding:12px;margin:10px 0">'+
        '<div style="color:#ebcb8b">● CHƯA MỞ</div><b>'+esc(m.question_text)+'</b>'+
        '<div style="color:#7b8494;margin:6px 0">Seed '+fmtT(m.seed_per_option)+'/cửa sẽ rút từ Kho bạc</div>'+
        '<button onclick="doOpen('+i+')">MỞ KÈO NÀY »</button></div>';
    }
    const doors=m.options.map((o,j)=>
      '<button style="display:block;width:100%;text-align:left;margin:6px 0" onclick="pickWinner('+i+','+j+')">'+
      '▸ '+esc(o.label)+'<br><span style="color:#7b8494">'+fmtT(o.volume)+' đang ở cửa này</span></button>').join('');
    return '<div style="border:1px solid #a3be8c;padding:12px;margin:10px 0">'+
      '<div style="color:#a3be8c">● ĐÃ KHÓA — CHỜ CHỐT</div><b>'+esc(m.question_text)+'</b>'+
      '<div style="color:#7b8494;margin:6px 0">Nguồn: '+esc(m.resolution_source_name)+
      ' · tổng pool '+fmtT(m.total_volume)+'</div>'+
      '<div style="margin-top:8px">Cửa nào ĐÚNG?</div>'+doors+
      '<div id="cfm'+i+'"></div></div>';
  }).join('');
}
async function doOpen(i){
  const m=TODO[i];
  const r=await api('/api/v1/admin/markets/'+m.market_id+'/open',{method:'POST',body:'{}'});
  alert(r.status===200?('Đã mở kèo. Seed rút: '+fmtT(r.body.seed_total)):('Lỗi: '+(r.body.message||r.status)));
  loadTodo();
}
// Bấm cửa → tự chạy PREVIEW (chỉ đọc) → hiện hậu quả thật + nút xác nhận.
// KHÔNG bắt gõ mã: mã vẫn được gửi kèm nên server vẫn chặn preview cũ khi pool
// đã đổi; chốt chặn chống bấm nhầm chuyển thành "nhìn số rồi bấm nút thứ hai".
async function pickWinner(i,j){
  const m=TODO[i],o=m.options[j];
  const box=$('cfm'+i);
  box.innerHTML='<p>Đang tính…</p>';
  const r=await api('/api/v1/admin/markets/'+m.market_id+'/preview-resolve?outcome_option_id='+o.option_id);
  if(r.status!==200){box.innerHTML='<p style="color:#bf616a">Lỗi: '+esc(r.body.message||r.status)+'</p>';return}
  const p=r.body;
  const mode=p.mode==='refund_players'?'HOÀN NGUYÊN (không ai đặt cửa thua → trả lại đúng số đã đặt, không thu phí)'
    :p.mode==='unclaimed_to_treasury'?'KHÔNG AI ĐẶT CỬA THẮNG → toàn bộ về Kho bạc'
    :'CHIA THƯỞNG BÌNH THƯỜNG';
  box.innerHTML='<div style="border:2px solid #ebcb8b;padding:12px;margin-top:10px">'+
    '<div style="color:#ebcb8b">XÁC NHẬN — không hoàn tác được (A3.2)</div>'+
    '<p>Cửa thắng: <b>'+esc(o.label)+'</b></p>'+
    '<p>Kiểu chia: <b>'+mode+'</b><br>'+
    'Số người được trả: <b>'+p.players_paid+'</b><br>'+
    'Tổng trả người chơi: <b>'+fmtT(p.total_player_payout)+'</b><br>'+
    'Seed về Kho bạc: <b>'+fmtT(p.seed_to_treasury)+'</b><br>'+
    'Đốt: <b>'+fmtT(p.burn_total)+'</b> · Kho bạc (phí): <b>'+fmtT(p.treasury_rake)+'</b></p>'+
    '<label>Ghi chú (số liệu nguồn — không bắt buộc)</label>'+
    '<input id="note'+i+'" placeholder="vd: BTC 20:00 = 64.100 so với 12:00 = 64.730 → −0,97%">'+
    '<button style="border-color:#bf616a;color:#bf616a" onclick="confirmWin('+i+','+j+',\\''+p.confirm_code+'\\')">'+
    '✓ CHỐT: "'+esc(o.label)+'" THẮNG</button>'+
    '<button onclick="$(\\'cfm'+i+'\\').innerHTML=\\'\\'">huỷ chọn</button></div>';
}
async function confirmWin(i,j,code){
  const m=TODO[i],o=m.options[j];
  const note=($('note'+i)||{}).value||'';
  const r=await api('/api/v1/admin/markets/'+m.market_id+'/resolve',{method:'POST',
    body:JSON.stringify({outcome_option_id:o.option_id,confirm_code:code,
      evidence_url:m.resolution_source_url,resolution_note:note})});
  if(r.status===200){
    alert('ĐÃ CHỐT KÈO.\\nTrả người chơi: '+fmtT(r.body.total_player_payout)+
          '\\nĐốt: '+fmtT(r.body.burn_total)+' · Kho bạc: '+fmtT(r.body.treasury_rake));
  } else {
    alert('Lỗi: '+(r.body.message||r.status));
  }
  loadTodo();
}

/*
 * DANH SACH KEO — HANH DONG NAM NGAY TREN DONG, KHONG COPY UUID.
 *
 * Ban cu doc endpoint NGUOI CHOI (/api/v1/markets) nen no KHONG BAO GIO thay ban
 * nhap — ma nhap lai dung la thu hay phai don nhat. Nay doc /api/v1/admin/keo,
 * thay du nam trang thai.
 *
 * Va moi dong tu mang DUNG nut cua trang thai no, vi hai thao tac nay KHAC NHAU
 * VE BAN CHAT chu khong phai hai muc cua mot thu:
 *   NHAP    -> GO BO: chua ai thay, khong tien, xoa han.
 *   MO/KHOA -> HUY: co nguoi dat tien that, hoan 100%, de lai vet vinh vien.
 * Gop lam mot nut "xoa" la moi nguoi ta bam nham cai thu hai khi dinh lam cai thu
 * nhat — va cai thu hai KHONG HOAN TAC DUOC.
 */
function _tt(t){
  const m={draft:'#7b8494',open:'#a3be8c',locked:'#ebcb8b',resolved:'#88c0d0',cancelled:'#bf616a'};
  return '<b style="color:'+(m[t]||'#7b8494')+'">'+t.toUpperCase()+'</b>';
}
async function loadMarkets(){
  $('mkts').innerHTML='<p style="color:#7b8494">đang tải…</p>';
  const r=await api('/api/v1/admin/keo?trang=0');
  /*
   * LOI KHAC HAN "KHONG CO KEO NAO" — ban cu khong doc status, nen 403 (chua mo
   * khoa 2FA) hay 401 (het phien) deu ra mang rong va panel in "Khong co keo
   * nao". Do la panel NOI DOI: nguoi doc ket luan kho keo trong roi di tim id o
   * cho khac, trong khi that ra ho dang bi khoa ngoai. Mot panel im con do hon
   * mot panel noi sai.
   */
  if(r.status!==200){
    $('mkts').innerHTML='<p style="color:#bf616a">Không tải được danh sách (HTTP '+
      r.status+'). Nếu là 401/403 thì mở khoá "MÃ HAI LỚP" ở đầu trang rồi bấm lại.</p>'+
      '<pre>'+JSON.stringify(r.body,null,2)+'</pre>';
    return;
  }
  const ks=(r.body.keo||r.body.markets||[]);
  if(!ks.length){$('mkts').innerHTML='<p style="color:#7b8494">Không có kèo nào.</p>';return;}
  window._keo=ks;
  const rows=ks.map(function(m,i){
    const vol=Number(m.volume_nguoi||0), ng=Number(m.so_nguoi||0);
    let nut='<span style="color:#7b8494">—</span>';
    if(m.status==='draft')
      nut='<button class="danger" onclick="goNhap('+i+')">GỠ BỎ</button>';
    else if(m.status==='open'||m.status==='locked')
      nut='<button class="danger" onclick="huyKeo('+i+')">HỦY — hoàn 100%</button>';
    return '<tr><td>'+_tt(m.status)+'</td><td>'+esc(m.question_text)+'</td>'+
      '<td>'+vol+' T / '+ng+' người</td>'+
      '<td><button onclick="pickMarket(\\''+m.market_id+'\\')">chọn »</button></td>'+
      '<td>'+nut+'</td></tr>';
  }).join('');
  $('mkts').innerHTML='<table><tr><th>trạng thái</th><th>câu hỏi</th><th>cược thật</th>'+
    '<th></th><th>gỡ / hủy</th></tr>'+rows+'</table>';
}

/* NHAP — chua ai thay, khong tien. Van hoi mot cau vi no xoa han. */
async function goNhap(i){
  const m=window._keo[i];
  if(!confirm('GỠ BỎ bản nháp?\\n\\n"'+m.question_text+'"\\n\\n'+
    'Nháp chưa mở nên không ai đặt gì và không hoàn cho ai cả.\\nXoá hẳn, không lấy lại được.')) return;
  const r=await api('/api/v1/admin/markets/'+m.market_id,{method:'DELETE'});
  show('a_out',r.body);
  if(r.body&&r.body.ok) loadMarkets();
}

/*
 * MO/KHOA — co tien that cua nguoi that.
 * Hop xac nhan noi DUNG SO TIEN va DUNG SO NGUOI se bi hoan, khong noi chung
 * chung "ban co chac khong". Mot cau hoi chung chung thi ai cung bam Yes; mot cau
 * co con so thi nguoi ta dung lai doc.
 */
async function huyKeo(i){
  const m=window._keo[i];
  const vol=Number(m.volume_nguoi||0), ng=Number(m.so_nguoi||0);
  const ly=prompt('HỦY kèo "'+m.question_text+'"?\\n\\n'+
    'Hoàn 100% cho '+ng+' người ('+vol+' T), không thu phí. Kèo đóng vĩnh viễn.\\n\\n'+
    'Nhập LÝ DO hủy (bắt buộc, người chơi đọc được):');
  if(ly===null) return;
  if(!ly.trim()){alert('Phải có lý do — người chơi cần biết vì sao kèo của họ bị hủy.');return;}
  const r=await api('/api/v1/admin/markets/'+m.market_id+'/cancel',
    {method:'POST',body:JSON.stringify({reason:ly.trim()})});
  show('a_out',r.body);
  if(r.body&&r.body.ok) loadMarkets();
}
async function pickMarket(id){
  $('a_mid').value=id;
  await loadOptions();                       // tự tải luôn danh sách cửa
  $('a_mid').scrollIntoView({block:'start'});
}
async function openMarket(){show('a_out',(await api('/api/v1/admin/markets/'+$('a_mid').value.trim()+'/open',{method:'POST',body:'{}'})).body)}
async function loadOptions(){
  const r=await api('/api/v1/admin/markets/'+$('a_mid').value.trim()+'/options');
  if(r.status!==200){show('a_out',r.body);return}
  const rows=(r.body.options||[]).map(o=>'<tr><td>'+esc(o.label)+'</td><td>'+o.total+' T</td><td>'+
    o.participants+' người</td><td><button onclick="pickOpt(\\''+o.option_id+'\\')">chọn cửa này</button></td>'+
    '</tr><tr><td colspan="4"><code>'+o.option_id+'</code></td></tr>').join('');
  $('a_opts').innerHTML='<p><b>'+esc(r.body.question_text)+'</b> — trạng thái: '+esc(r.body.status)+'</p>'+
    '<table><tr><th>cửa</th><th>tổng</th><th>người</th><th></th></tr>'+rows+'</table>';
}
function pickOpt(id){$('a_oid').value=id;$('a_oid').scrollIntoView({block:'center'})}
async function previewResolve(){
  const r=await api('/api/v1/admin/markets/'+$('a_mid').value.trim()+
    '/preview-resolve?outcome_option_id='+$('a_oid').value.trim());
  if(r.status!==200){show('a_out',r.body);return}
  const b=r.body;
  // Mã hiện TO, đọc được trên điện thoại — KHÔNG tự điền (mã là chốt chặn để
  // người thật nhìn lại số trước khi chia tiền, tự điền là mất tác dụng)
  $('a_out').innerHTML=
    '<div style="font-size:1.05rem;line-height:1.9">'+
    'Tổng pool: <b>'+b.pool_total+' T</b><br>'+
    'Số người được trả: <b>'+b.players_paid+'</b><br>'+
    'Tổng trả người chơi: <b>'+b.total_player_payout+' T</b><br>'+
    'Seed về Kho bạc: <b>'+b.seed_to_treasury+' T</b><br>'+
    'Đốt: <b>'+b.burn_total+' T</b> · Kho bạc (rake): <b>'+b.treasury_rake+' T</b><br>'+
    'Kiểu chia: <b>'+b.mode+'</b>'+
    '</div><div style="margin-top:14px;padding:12px;border:2px solid #a3be8c;text-align:center">'+
    'MÃ XÁC NHẬN — gõ lại vào ô dưới<br>'+
    '<span style="font-size:2.2rem;letter-spacing:.35em;color:#a3be8c"><b>'+b.confirm_code+'</b></span>'+
    '</div>';
}
async function commitResolve(){
  const r=await api('/api/v1/admin/markets/'+$('a_mid').value.trim()+'/resolve',{method:'POST',
    body:JSON.stringify({outcome_option_id:$('a_oid').value.trim(),confirm_code:$('a_code').value.trim(),
      evidence_url:$('a_ev').value.trim(),resolution_note:$('a_note').value.trim()})});
  show('a_out',r.body);
}
async function cancelMarket(){
  const r=await api('/api/v1/admin/markets/'+$('a_mid').value.trim()+'/cancel',{method:'POST',
    body:JSON.stringify({reason:$('a_reason').value.trim()})});
  show('a_out',r.body);
}
</script>
</body>
</html>`;
