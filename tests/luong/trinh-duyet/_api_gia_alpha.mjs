/**
 * API GIẢ cho kịch bản luồng trình duyệt Alpha Draft (sảnh + màn kết + Hub/Oracle) — KHÔNG DB, KHÔNG prod; chỉ trả đúng hình DTO mà web đọc.
 * Điều khiển qua `/__ctl?khoá=giá trị` (xem `st`): mode(so|khach|chua) · lat(ms; <0 = GIỮ phản hồi tới `tha=1`) · off(1 = đứt kết nối) ·
 * loi(1 = 500) · loiAutopsy(1 = chỉ /autopsy 500) · ngay(chua|dang|xong) · dang(1 = có bàn đang dở) · tran(xong|dang) · hang(1|3|6) · pc(0 = không có phong cách) · tienDo(số trận xong).
 * `/__n` = bộ đếm request theo "METHOD /đường" (kiểm "bấm đúp không gửi trùng").
 */
import http from 'node:http';

export const st = {
  mode: 'so', lat: 0, off: 0, loi: 0, loiAutopsy: 0, ngay: 'chua', dang: 0, tran: 'xong', hang: 3, pc: 1, tienDo: 7, n: {},
};
const giu = [];

const user = (m) => ({
  user_id: 'u1', handle: 'orca_21', age_band: '19_22', region: 'hn', occupation_band: 'sv', bankroll: 1250, role: 'user',
  research_consent: true, created_at: '2026-10-01T00:00:00Z', season_id: 's0', la_khach: m === 'khach',
});
const VIEC = [
  { nv_id: 'v1', ten: 'Chơi 3 trận Alpha Draft', muc: 3, da: 3, xong: true }, { nv_id: 'v2', ten: 'Ghi sổ 5 ngày', muc: 5, da: 5, xong: true },
  { nv_id: 'v3', ten: 'Chốt sổ tuần', muc: 1, da: 1, xong: true }, { nv_id: 'v4', ten: 'Thử một lá mới', muc: 1, da: 0, xong: false },
];
const lt = () => ({ mua_mo: true, tuan: 3, so_tuan: 4, chang: 2, so_chang: 30, quest_points: 10, viec: VIEC, da_diem_danh_hom_nay: false, moc: [] });

/** Luật đang chạy (v66): MỘT cỡ bàn 14 ô, khẩu vị tắt — catalog nói thế, sảnh không được chép tay. */
const CATALOG = {
  engine_version: 'holdem-qc-1', balance_version: 'balance-v66-laiap',
  luat: { SEATS: 6, START_VON: 10000, MAX_TAI_SAN: 4, MAX_CHIEN_THUAT: 2 },
  nhip_chon_bai: [], cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 14, SHOWDOWN_MODEL: 'A', CO_MAP_CHON: [14], MAP_MAC_DINH_SANH: 14 },
  vai: { ca_map: { id: 'ca_map', ten: 'CÁ MẬP' } },
  tai_san: [{ id: 'btc', label: 'Crypto' }, { id: 'vang', label: 'Vàng' }, { id: 'cp_cn', label: 'Cổ phiếu Tech' }],
  chien_thuat: [{ id: 'don_bay', label: 'Đòn bẩy' }, { id: 'luot_song', label: 'Lướt sóng' }, { id: 'bat_day', label: 'Bắt đáy' }],
  giai_doan: [{ id: 'tang', label: 'Tăng' }, { id: 'giam', label: 'Giảm' }],
  su_kien: [{ id: 'tin_lai', label: 'Tin lãi suất' }, { id: 'tin_gia', label: 'Tin đồn' }],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [{ id: 'can_bang', label: 'Cân bằng', he_so_bp: 10000, mo_ta: '' }], khau_vi_tat: true,
  nhiem_vu_ky_ngo: [],
};
const ART = (() => {
  const mau = { btc: '#fb923c', vang: '#fbbf24', cp_cn: '#38bdf8', don_bay: '#a855f7', luot_song: '#22d3ee', bat_day: '#4ade80' };
  const o = {};
  for (const [k, c] of Object.entries(mau)) o[k] = `<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="#0b1628"/><rect x="2" y="2" width="4" height="4" fill="${c}"/></svg>`;
  return o;
})();

const ngayBan = () => {
  const goc = {
    ma: 'q7p2z', so_o: 14, het_han: new Date(Date.now() + 5 * 3600_000).toISOString(), created_at: 'x', loai: 'ngay',
    chu: 'DELPHI', la_chu: false, so_nguoi: 228, toi: null, toi_da_xong: false, doi: [],
    thu_thach: { ngay: '2026-10-11', so_nguoi_vao: 230, so_nguoi_xong: 228 },
  };
  if (st.ngay === 'dang') return { ...goc, toi: { match_id: 'm-ngay', status: 'dang_choi' } };
  if (st.ngay === 'xong') {
    return { ...goc, toi: { match_id: 'm-xong', status: 'xong' }, toi_da_xong: true,
      thu_thach: { ...goc.thu_thach, nav: 12340, hang: 41, tong: 228, top_pct: 18 } };
  }
  return goc;
};

const GHE = [
  ['ban', 'nguoi', 'orca_21', 'Cá Ngừ'], ['g1', 'bot', 'Máy · Cá Mập', 'Cá Mập'], ['g2', 'bot', 'Máy · Orca', 'Cá Heo'],
  ['g3', 'nguoi', 'lan_anh', 'Cá Mòi'], ['g4', 'bot', 'Máy · Giờ', 'Cua'], ['g5', 'nguoi', 'minh_quan', 'Tôm'],
];
const autopsy = () => {
  const toi = st.hang;
  const hangCua = (i) => (i === 0 ? toi : (i < toi ? i : i + 1));
  const xep = GHE.map(([ghe_id, loai, ten, bac_rank], i) => ({
    hang: hangCua(i), ghe_id, loai, ten, bac_rank, von: ghe_id === 'ban' ? (toi === 6 ? 0 : 11840) : 9000 + i * 300,
    vong_chay: ghe_id === 'ban' && toi === 6 ? 6 : null,
    danh_muc: ghe_id === 'ban'
      ? { tai_san: toi === 6 ? ['btc'] : ['btc', 'vang', 'cp_cn'], chien_thuat: toi === 6 ? ['don_bay'] : ['don_bay', 'luot_song'] }
      : { tai_san: ['vang'], chien_thuat: ['bat_day'] },
    diem_truoc: ghe_id === 'ban' ? 100 : null, diem_sau: ghe_id === 'ban' ? 124 : null,
  })).sort((a, b) => a.hang - b.hang);
  return {
    match_id: 'm-xong', xong: true, xep_hang: xep,
    map_da_lo: Array.from({ length: 14 }, (_, i) => (i % 4 === 3
      ? { kind: 'su_kien', su_kien: i === 7 ? 'tin_gia' : 'tin_lai', la_tin_gia: i === 7 || i === 11 }
      : { kind: 'giai_doan', giai_doan: i % 2 ? 'tang' : 'giam' })),
    khoanh_khac: [{ id: 'tin_gia', vong: 6, delta_bp: -3140 }],
    nang_luc: { formula_version: 1, tinh_vao_the: true, ly_do_khong_tinh: null,
      nang_luc: [{ id: 'doc_tin', bac: 'lam_duoc', bang_chung: { so_vong: 8 } }, { id: 'phan_tan', bac: 'da_gap', bang_chung: {} }] },
    phong_cach: st.pc ? { diem: 742, hang: toi === 1 ? 'SSS' : toi === 6 ? 'D' : 'A', streak: 2, streak_dai_nhat: 4, ba_truc: { doc: 0.71, thang_cho: 0.64, tru: 0.8 } } : undefined,
    nav_theo_vong: Array.from({ length: 13 }, (_, v) => ({ vong: v + 1, nav: { ban: 10000 + v * 150, g1: 10000, g2: 9900, g3: 10100, g4: 9800, g5: 9700 } })),
    dau_moc: [{ id: 'chuoi_dung_huong', vong: 9, so: 3 }],
    ban_ma: null,
  };
};
const trangThai = (id) => {
  const xong = id === 'm-xong';
  return {
    match_id: id, vong: xong ? 13 : 5, tong_vong: 13, status: xong ? 'xong' : 'dang_choi', ban_ma: null,
    ban: {
      von: 11840, luot_khao_sat: 0, vi_the: {}, da_chay: false, tu_the: 'choi', vong_roi: null, so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang',
      danh_muc: { tai_san: ['btc', 'vang', 'cp_cn'], chien_thuat: ['don_bay', 'luot_song'] }, fx: {}, nav: 11840, tien_mat: 1000,
    },
    doi_thu: GHE.slice(1).map(([ghe_id, loai, ten, bac_rank]) => ({ ghe_id, loai, ten: loai === 'bot' ? ten : ten, bac_rank })),
    shop: null, xong,
  };
};

const gui = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

export function khoiDongApi(port) {
  const sv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__ctl') {
      for (const [k, v] of u.searchParams) {
        if (k === 'mode' || k === 'ngay' || k === 'tran') st[k] = v;
        else if (k === 'reset') st.n = {};
        else if (k === 'tha') { while (giu.length) giu.shift()(); }
        else st[k] = Number(v);
      }
      return gui(res, 200, st);
    }
    if (u.pathname === '/__n') return gui(res, 200, st.n);
    if (u.pathname.startsWith('/api/v1/telemetry')) { res.writeHead(202); return res.end('{"ok":true}'); }
    const khoa = `${req.method} ${u.pathname.replace('/api/v1', '')}`;
    st.n[khoa] = (st.n[khoa] ?? 0) + 1;
    const xong = () => {
      if (st.off) { req.socket.destroy(); return; }
      const p = u.pathname.replace('/api/v1', '');
      if (st.loi && p !== '/auth/me') return gui(res, 500, { error: 'server', message: 'Lỗi giả' });
      if (khoa === 'GET /auth/me') {
        return st.mode === 'chua' ? gui(res, 401, { error: 'unauthorized', message: 'x' })
          : gui(res, 200, { email: 'a@b.c', email_verified: true, onboarded: true, user: user(st.mode), pfm: null, buoi_do: null, hoi_nhan_khau: false });
      }
      if (khoa === 'GET /me/nhiem-vu') return gui(res, 200, lt());
      if (khoa === 'GET /holdem/catalog') return gui(res, 200, CATALOG);
      if (khoa === 'GET /holdem/art') return gui(res, 200, { version: CATALOG.engine_version, art: ART });
      if (khoa === 'GET /holdem/me/tien-do') return gui(res, 200, { so_tran_xong: st.tienDo, co_map: [14], khau_vi: false, con_thieu: {} });
      if (khoa === 'GET /holdem/me/matches') {
        return gui(res, 200, { tran: st.dang ? [{ match_id: 'm-dang', status: 'dang_choi', vong_hien_tai: 5, started_at: '', ended_at: null, tiep_duoc: true }] : [] });
      }
      if (khoa === 'GET /holdem/ngay') return gui(res, 200, ngayBan());
      if (khoa === 'POST /holdem/matches') return gui(res, 201, trangThai('m-moi'));
      if (khoa === 'POST /holdem/ban') return gui(res, 201, { ma: 'k7qx2', so_o: 14, het_han: new Date(Date.now() + 24 * 3600_000).toISOString() });
      let m = /^GET \/holdem\/matches\/([\w-]+)\/autopsy$/.exec(khoa);
      if (m) return st.loiAutopsy ? gui(res, 500, { error: 'server', message: 'Lỗi giả (autopsy)' }) : gui(res, 200, autopsy());
      m = /^GET \/holdem\/matches\/([\w-]+)$/.exec(khoa);
      if (m) return gui(res, 200, trangThai(st.tran === 'xong' || m[1] === 'm-xong' ? 'm-xong' : m[1]));
      m = /^GET \/holdem\/ban\/(\w+)$/.exec(khoa);
      if (m) return gui(res, 200, m[1] === 'q7p2z' ? ngayBan() : { ma: m[1], so_o: 14, het_han: new Date(Date.now() + 3600_000).toISOString(), created_at: 'x', chu: 'x', la_chu: false, so_nguoi: 1, toi: null, toi_da_xong: false, doi: [] });
      return gui(res, 404, { error: 'not_found', message: 'x' });
    };
    if (st.lat < 0) giu.push(xong); else setTimeout(xong, st.lat);
  });
  return new Promise((r) => { sv.listen(port, () => r(sv)); });
}
export const ctl = (port, q) => fetch(`http://localhost:${port}/__ctl?${q}`).then((r) => r.json());
export const nmock = (port) => fetch(`http://localhost:${port}/__n`).then((r) => r.json());
