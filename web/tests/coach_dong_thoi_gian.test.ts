/**
 * TRỢ LÝ MÀN TẬP — BÀI CANH DÒNG THỜI GIAN (D336, 15/09).
 *
 * ⚠⚠ Vì sao có tệp này. Ngày 15/09 bộ canh coach cũ xanh 123/123 trong khi tự chơi
 * trọn bàn tập cho thấy Oracle CÂM từ vòng 8 tới vòng 11 ở mọi lượt: bài ngân hàng,
 * cú VỠ, trượt giá không một lời. Mọi bài cũ hỏi MỘT bước đứng một mình ("neo có thật
 * không", "`cho`/`tuXong` có loại trừ nhau không", "có `troi` không"); không bài nào
 * CHẠY kịch bản dọc cả trận để hỏi "bước này có TỚI LƯỢT được không".
 *
 * Bài này dựng bối cảnh từng vòng từ CHÍNH bàn tập (`sinhMap` + nhịp chọn bài của luật
 * đang chạy), cho ba kiểu người chơi đi hết 12 vòng qua `chonBuoc` — đúng hàm component
 * dùng — và đòi mỗi bài học phải hiện ở đúng vòng của nó.
 *   1. LÀM THEO LỜI — bấm đúng chỗ đèn rọi, xong vòng thì chốt.
 *   2. ĐỂ MÁY CHỐT HỘ — nghe một câu rồi ngồi im tới hết giờ (lượt tự chơi 15/09 bị
 *      máy chốt hộ tám vòng liền).
 *   3. LÀM TRƯỚC KHI ĐƯỢC BẢO — tự mở shop, VÌ SAO, bảng điện tử trước lời Oracle.
 * Tiêm lỗi sẵn trong tệp (mục IV): đưa một bước làn khi-xảy-ra về mạch kể ⇒ phải đỏ.
 */
import { describe, expect, it } from 'vitest';
import {
  HOLDEM_DECISIONS, luatCua, nhipChonBai, seedManTap,
} from '@config/holdem';
import { mocKipCua, tuyChonSinhMap } from '@server/holdem/engine';
import { sinhMap } from '@server/holdem/map';
import {
  KICH_BAN, chonBuoc, goiY, type BoiCanhTap, type Buoc,
} from '../src/components/holdem/CoachTap';

const SO_O = HOLDEM_DECISIONS.MAN_TAP_SO_O;
// D392 → gộp 0.0.46 — luật GHIM của bàn tập (một nguồn `HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION`), đúng cửa server dùng.
// D527 — `KICH_BAN` v54 còn chạy cho trận tập v54 dở; bàn tập mặc định (v58) có kịch bản riêng ⇒ ghim v54 đích danh.
const KHOA_TAP = 'balance-v54-ngare';
const luat = luatCua(KHOA_TAP);
const ban = sinhMap(seedManTap(KHOA_TAP), SO_O, tuyChonSinhMap(luat));
// D433 — nhịp của CHÍNH luật bàn tập (server: `nhipChonBai(so_o, st.ky_ngo, st.gian_la)`); ghim `true, true` là mô
// phỏng một bàn tập có kỳ ngộ trong khi bàn thật (v54) không có.
const nhip = nhipChonBai(SO_O, luat.kyNgo, luat.gianLaMapNgan);
const DEN = HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG;
/** D433 — số VÒNG của bàn (server `soVong`, D382): luật ô úp có lá mở màn ⇒ 12 ô = 11 vòng. */
const SO_VONG = SO_O - (luat.oUp ? 1 : 0);

const laSuKien = (v: number) => ban.o[v - 1]?.kind === 'su_kien';
const laTinGia = (v: number) => {
  const o = ban.o[v - 1];
  return o?.kind === 'su_kien' && o.la_tin_gia === true;
};

/** Bối cảnh ĐẦU vòng `v`, sau khi ô lật xong — dữ liệu suy từ bàn tập thật. */
function dauVong(v: number): BoiCanhTap {
  return {
    vong: v, tongVong: SO_VONG, vongTamDungDen: DEN,
    shopMo: false, bangMo: false, bangDangMo: false, shopChonMa: false, shopCoLenh: false,
    coKetQua: v > 1, sanKhau: false,
    // Telegraph (server `telegraph` đọc lá `iLaBaoTruoc`): luật ngửa — ô ngay trước ô của vòng; D433, luật ô úp —
    // lá VỪA LẬT (ô v), đúng lá bot đọc.
    coTinTruoc: luat.oUp ? laSuKien(v) : v > 1 && laSuKien(v - 1),
    // Kết quả vòng v−1 lộ tin giả của ô v−2 ("tin giả của vòng TRƯỚC lộ ở vòng này").
    tinGiaLo: v > 2 && laTinGia(v - 2),
    // Bàn tập cố định (D302): đám đông không bẻ ô.
    oVuaDoi: false,
    coChenChuc: false,
    loaiVongNay: nhip[v - 1] ?? 'khong',
    xong: false, onMoShop: () => {},
    moLyDo: false, chonLoi: false, tamMo: null, daDocTo: false, toMo: false, moLaiSuat: false,
    chaoVaiXong: v === 1 ? false : true, chaoVaiPha: v === 1 ? 'chia' : null,
    kyNgoMoi: nhip[v - 1] === 'ky_ngo', kyNgoMo: nhip[v - 1] === 'ky_ngo', kyNgoDaMo: nhip[v - 1] === 'ky_ngo',
    kyNgoDaChon: false,
    // v43 — cờ server `ngan_hang_mo` = còn mốc kỳ hạn "kịp" theo `mocKipCua(vong, so_o)` — gọi đúng hàm ấy.
    nganHangMo: mocKipCua(v, SO_O).length > 0, chonGui: false,
  };
}

/** Việc người chơi LÀM ĐÚNG khi bước chờ tay hiện ra — đổi bối cảnh cho `tuXong` đúng. */
const LAM: Record<string, (b: BoiCanhTap) => void> = {
  'chia-vai': (b) => { b.chaoVaiPha = 'toi'; },
  'vai-cua-ban': (b) => { b.chaoVaiXong = true; b.chaoVaiPha = null; },
  'mo-shop': (b) => { b.shopMo = true; },
  'mo-shop-loi': (b) => { b.shopMo = true; },
  taisan: (b) => { b.shopChonMa = true; },
  'shop-lenh': (b) => { b.shopCoLenh = true; b.shopChonMa = false; },
  chot: (b) => { b.shopMo = false; },
  ketqua: (b) => { b.moLyDo = true; },
  'tin-gia-lo': (b) => { b.moLyDo = true; },
  'vi-sao': (b) => { b.moLyDo = false; },
  'doc-loi': (b) => { b.daDocTo = true; },
  'loi-chien-thuat': (b) => { b.chonLoi = true; },
  'mo-bang': (b) => { b.bangMo = true; b.bangDangMo = true; },
  'chuyen-v4': (b) => { b.moLaiSuat = true; },
  'truot-gia': (b) => { b.moLyDo = true; },
  'ngan-hang-ky': (b) => { b.chonGui = true; },
};

interface Luot { vong: number | 'ket'; id: string }

/**
 * Chạy trọn bàn tập. `kieu` quyết cách người chơi đáp mỗi bước; trả dãy bước ĐÃ HIỆN
 * (theo vòng). Dàn cảnh (`shop`/`lyDo`/`tam`) áp như component áp.
 */
function choiTron(
  kichBan: readonly Buoc[], kieu: 'theo_loi' | 'may_chot_ho' | 'lam_truoc',
): Luot[] {
  const daQua = new Set<string>();
  const hien: Luot[] = [];
  /*
   * D336 lượt 2 — `daHien` là "đã hiện LÚC VIỆC CHƯA XONG" (luật của `chonBuoc`, component ghi y hệt):
   * bước hiện ra khi việc đã xong sẵn thì KHÔNG vào sổ này, nên nó đứng lại với nút TIẾP.
   */
  const daHien = new Set<string>();
  const dongSo = (ids: readonly string[]) => { for (const id of ids) daQua.add(id); };
  for (let v = 1; v <= SO_VONG; v += 1) {
    const b = dauVong(v);
    if (kieu === 'lam_truoc') {
      b.shopMo = v === 2; b.moLyDo = v === 2; b.bangMo = v >= 2; b.moLaiSuat = v >= 4;
      if (v === 1) { b.chaoVaiXong = true; b.chaoVaiPha = null; }
    }
    let soBuoc = 0;
    for (;;) {
      if (soBuoc++ > 60) throw new Error(`vòng ${v}: trợ lý quay vòng vô hạn`);
      // Bảng đang mở thì người chơi đọc rồi đóng — trợ lý chờ bảng đóng.
      if (b.bangDangMo) { b.bangDangMo = false; continue; }
      const { buoc, ghi } = chonBuoc(kichBan, daQua, b, daHien);
      dongSo(ghi);
      if (!buoc) {
        /*
         * D336 lượt 2 — người LÀM THEO LỜI cũng làm theo dòng thu gọn: vòng lõi mà shop đóng thì Oracle
         * nói "Vòng lõi: mở SHOP để chọn một lõi" (`goiY`). Bước `loi-don-bay` chờ đúng cú mở ấy.
         */
        const g = goiY(b);
        if (kieu === 'theo_loi' && b.moLyDo && g.includes('ẨN LÝ DO')) { b.moLyDo = false; continue; }
        if (kieu === 'theo_loi' && !b.shopMo && g === 'Vòng lõi: mở SHOP để chọn một lõi.') {
          b.shopMo = true;
          continue;
        }
        break;
      }
      if (!hien.some((h) => h.id === buoc.id)) hien.push({ vong: v, id: buoc.id });
      if (buoc.shop !== undefined) b.shopMo = buoc.shop;
      if (buoc.lyDo !== undefined) b.moLyDo = buoc.lyDo;
      if (buoc.tam !== undefined) b.tamMo = buoc.tam;
      const viecDaXong = buoc.tuXong?.(b) === true;
      if (!viecDaXong) daHien.add(buoc.id);
      if (kieu === 'may_chot_ho') break;          // nghe một câu, rồi hết giờ
      const lam = LAM[buoc.id];
      if (!buoc.tuXong || viecDaXong) daQua.add(buoc.id); // bước đọc, hoặc việc đã xong sẵn: bấm TIẾP
      else if (lam) lam(b);
      else daQua.add(buoc.id);                     // chưa mô tả việc ⇒ BỎ QUA BƯỚC NÀY
    }
  }
  // Màn kết.
  const ket: BoiCanhTap = { ...dauVong(SO_VONG), vong: SO_VONG + 1, xong: true, coKetQua: false };
  for (let i = 0; i < 5; i += 1) {
    const { buoc, ghi } = chonBuoc(kichBan, daQua, ket);
    dongSo(ghi);
    if (!buoc) break;
    hien.push({ vong: 'ket', id: buoc.id });
    daQua.add(buoc.id);
  }
  return hien;
}

/** Vòng mà mỗi bước MẠCH KỂ phải hiện ra ở người làm theo lời. */
const VONG_CUA: Readonly<Record<string, number | 'ket'>> = {
  'chia-vai': 1, 'vai-cua-ban': 1, vai: 1, 'muc-tieu': 1,
  // D445 — đọc màu bàn + lá mở màn ⇒ xác suất lá kế, ngay vòng 1 (trước khi mở shop).
  'la-mo-man': 1, 'doan-la-ke': 1, 'mo-shop': 1, 'hai-phe': 1, taisan: 1,
  'shop-lenh': 1, 'xem-truoc': 1, chot: 1,
  /*
   * D351 — `mo-bang` 3 → 2, `danh-muc` 2 → 3. Vòng 2 nay kể MỘT MẠCH về phí: đau ở vòng 1 →
   * `vi-sao` gọi tên phí và nối nó với sổ lệnh → `mo-bang` chỉ chỗ nhìn sổ lệnh → `loi-chien-thuat`
   * khép bằng Lướt Sóng (quầy vòng 2 ghim sẵn lá đó). Bản cũ dạy bảng ở vòng 3, tức mắt xích
   * "nhìn ở đâu" tới sau hai vòng kể từ lúc cần — và hai teammate 19/09 dừng ở vòng 2 mà chưa
   * từng nghe tới bảng.
   * ⚠ `danh-muc` xuống vòng 3 là phần TRẢ GIÁ: thêm một mắt xích thì phải bớt một bước, để vòng 2
   * vẫn đúng 8 bước. Vòng 2 vốn đã là vòng nặng nhất bàn tập.
   */
  'thi-truong': 2, ketqua: 2, 'vi-sao': 2, 'chuyen-v2': 2, 'mo-bang': 2, 'mo-shop-loi': 2,
  'doc-loi': 2, 'loi-chien-thuat': 2,
  // D433 (v54 ô úp) — `du-bao-ky-hop`: vòng 3 cược vào ô 4 ⚖ còn úp.
  'chuyen-v3': 3, 'danh-muc': 3, 'so-lien-he': 3, 'du-bao-ky-hop': 3,
  'chuyen-v4': 4, 'lai-suat': 4, 'loi-don-bay': 4,
  'chuyen-v5': 5, tay: 5, 'mau-xanh': 6,
  // D433 — `ky-ngo` nghỉ (v54 tắt kỳ ngộ). Ô 9 quyết toán vòng 8 ⇒ báo trước ở 7; hệ quả lúc chốt + RÚT + ngân hàng
  // ở 8; vòng 9 kể ô vừa lật.
  'chuyen-v7': 7, 'bao-ky-hop': 7, 'vi-sao-tang-lai': 7,
  'rui-ro-ky-hop': 8, rut: 8, 'ngan-hang': 8, 'ngan-hang-ky': 8,
  'chuyen-v9': 9,
  'dong-ho': DEN + 1, 'chuyen-v10': 10,
  'phong-cach': 11, 'chuyen-v12': SO_VONG,
  het: 'ket',
};

// ─── I. NỀN — bàn tập đúng như kịch bản giả định ───────────────────────────
describe('I. Nền của mô phỏng khớp bàn tập thật', () => {
  it('bàn 12 ô = 11 vòng (ô úp, D382) · KHÔNG kỳ ngộ (v54) · vòng lõi 2·4·6 · D445: ô 2 là lá GIẢM, không tin giả', () => {
    expect(ban.o.length).toBe(12);
    expect(luat.oUp).toBe(true);
    expect(SO_VONG).toBe(11);
    expect(nhip).not.toContain('ky_ngo');
    expect([2, 4, 6].every((v) => nhip[v - 1] === 'chien_thuat')).toBe(true);
    expect(laTinGia(2)).toBe(false);
  });

  it('⭐ mọi bước mạch kể đều có vòng khai ở VONG_CUA — thêm bước mà quên khai là đỏ', () => {
    const chinh = KICH_BAN.filter((b) => b.lan !== 'khi').map((b) => b.id).sort();
    expect(chinh).toEqual(Object.keys(VONG_CUA).sort());
  });
});

// ─── II. LÀM THEO LỜI — mỗi bài học tới đúng vòng ─────────────────────────
describe('II. Người làm theo lời nghe ĐỦ mạch kể, đúng vòng', () => {
  const luot = choiTron(KICH_BAN, 'theo_loi');
  const vongHien = new Map(luot.map((l) => [l.id, l.vong]));

  for (const [id, vong] of Object.entries(VONG_CUA)) {
    it(`${id} hiện ở ${vong === 'ket' ? 'màn kết' : `vòng ${vong}`}`, () => {
      expect(vongHien.has(id), `bước ${id} KHÔNG BAO GIỜ hiện — trợ lý câm ở đó`).toBe(true);
      expect(vongHien.get(id)).toBe(vong);
    });
  }

  it('⭐⭐ không vòng nào từ 1 tới 12 thiếu hẳn lời Oracle ở vòng có bài dạy', () => {
    const coBai = new Set(Object.values(VONG_CUA).filter((v): v is number => typeof v === 'number'));
    const daNoi = new Set(luot.map((l) => l.vong));
    for (const v of coBai) expect(daNoi.has(v), `vòng ${v} có bài dạy mà Oracle không nói`).toBe(true);
  });

  /*
   * D433 (v54 ô úp) — tin ô 2 lật ở đầu vòng 2, nhưng vòng 2 kín mạch kể và shop mở tới lúc chốt; lá tin kế (ô 4 ⚖)
   * lật ở vòng 4 ⇒ bài gạch nghiêng tới ở vòng 4, cùng vòng với băng lộ tin giả (engine lộ ở kết quả vòng 3).
   */
  /*
   * D445 — seed dạy màu bàn KHÔNG có tin giả (không seed nào trong 6 triệu vừa có lõi bài màu bàn vừa có tin giả trước
   * ô 9) ⇒ `tin-gia-lo` không bao giờ nổ ở bàn tập; nó vẫn là bài khi-xảy-ra của trận thật. Gạch nghiêng vẫn tới ở vòng 4.
   */
  it('⭐ làn khi-xảy-ra: tin trước nổ ở vòng 4; lộ tin giả KHÔNG (seed không có tin giả); bẻ ô KHÔNG nổ (bàn tập cố định)', () => {
    expect(vongHien.get('tin-truoc')).toBe(4);
    expect(vongHien.has('tin-gia-lo')).toBe(false);
    expect(vongHien.has('dam-dong-be-o')).toBe(false);
  });
});

// ─── III. HAI KIỂU NGƯỜI CHƠI KHÁC — bài học của vòng sau không bị vòng trước chặn ─
describe('III. Người không làm theo lời vẫn nghe được bài của mỗi vòng', () => {
  /*
   * Bước KỂ CHUYỆN theo ô (có `keO`) cộng đồng hồ + tổng kết: đây là mạch mà một người
   * ngồi im cũng phải nghe được — vòng nào có bài của vòng đó.
   */
  const MOC_TRUYEN = KICH_BAN
    .filter((b) => b.keO !== undefined || b.id === 'dong-ho' || b.id === 'chuyen-v12')
    .map((b) => b.id);

  it('⭐⭐ ĐỂ MÁY CHỐT HỘ — mỗi vòng nghe ít nhất câu đầu của vòng đó, không vòng nào bị vòng trước chặn', () => {
    const luot = choiTron(KICH_BAN, 'may_chot_ho');
    const vongCoLoi = new Set(luot.map((l) => l.vong));
    for (const v of new Set(Object.values(VONG_CUA).filter((x): x is number => typeof x === 'number'))) {
      expect(vongCoLoi.has(v), `vòng ${v}: người ngồi im không nghe được câu nào`).toBe(true);
    }
    // Và không bước nào hiện SAU vòng của nó.
    for (const l of luot) {
      const dung = VONG_CUA[l.id];
      if (typeof dung === 'number' && typeof l.vong === 'number') {
        expect(l.vong, `${l.id} hiện muộn ở vòng ${l.vong}`).toBeLessThanOrEqual(dung);
      }
    }
  });

  it('⭐ LÀM TRƯỚC KHI ĐƯỢC BẢO — việc đã làm thì bước tự qua, mạch kể theo ô vẫn đủ', () => {
    const luot = choiTron(KICH_BAN, 'lam_truoc');
    const ids = new Set(luot.map((l) => l.id));
    for (const id of MOC_TRUYEN) expect(ids.has(id), `${id} bị nuốt ở người làm trước`).toBe(true);
  });
});

// ─── IV. TIÊM LỖI NGAY TRONG BÀI — mô phỏng phải bắt được lớp lỗi 15/09 ──────
describe('IV. Mô phỏng bắt được kiểu kẹt đầu hàng (tiêm lỗi thường trực)', () => {
  it('⭐⭐ đưa `dam-dong-be-o` về mạch kể (như trước D336) ⇒ ngân hàng và cú VỠ biến mất', () => {
    const hong = KICH_BAN.map((b) => (b.id === 'dam-dong-be-o' ? { ...b, lan: undefined } : b));
    const ids = new Set(choiTron(hong, 'theo_loi').map((l) => l.id));
    // Bàn tập tắt bẻ ô ⇒ bước ấy chờ mãi; mạch kể sau nó phải câm — nếu bài này XANH
    // tức mô phỏng không còn nhìn thấy kiểu kẹt đã giết nửa sau bàn tập.
    expect(ids.has('ngan-hang')).toBe(false);
    expect(ids.has('chuyen-v10')).toBe(false);
  });

  it('⭐ một bước mạch kể có `cho` không bao giờ đúng ⇒ các bước sau cùng vòng bị chặn, vòng sau thì KHÔNG', () => {
    /*
     * D351 — `mo-bang` dời từ vòng 3 sang vòng 2, nên "bước sau nó cùng vòng" đổi từ
     * `so-lien-he` (vòng 3) sang `mo-shop-loi` (vòng 2). Ý bài KHÔNG đổi: hỏng một bước thì
     * phần đuôi CÙNG VÒNG câm, vòng sau vẫn nói. Nay khẳng định được cả hai vế mạnh hơn bản
     * cũ — vòng 3 không chỉ "vẫn có bước nào đó", mà `so-lien-he` phải hiện đúng vòng 3.
     */
    const hong = KICH_BAN.map((b) => (b.id === 'mo-bang' ? { ...b, cho: () => false } : b));
    const vongHien = new Map(choiTron(hong, 'theo_loi').map((l) => [l.id, l.vong]));
    expect(vongHien.has('mo-shop-loi'), 'cùng vòng 2, đứng sau mo-bang ⇒ phải bị chặn').toBe(false);
    expect(vongHien.has('loi-chien-thuat'), 'cuối mạch vòng 2 ⇒ cũng bị chặn').toBe(false);
    expect(vongHien.get('so-lien-he'), 'vòng 3 KHÔNG được vạ lây').toBe(3);
    expect(vongHien.get('chuyen-v4')).toBe(4);          // vòng sau vẫn nói
  });
});

// ─── IV-b. CÚ TĂNG LÃI ĐƯỢC BÁO TRƯỚC VÀ GIẢI THÍCH (founder 15/09) ──────────
describe('IV-b. Kỳ họp tăng lãi: báo trước một vòng, nói vì sao, chỉ chỗ đổi danh mục', () => {
  /*
   * Founder 15/09: *"auto thua vì phần hướng dẫn chả cảnh báo hoặc điều hướng pivot gì khi
   * tăng lãi suất xảy ra cũng như ko nói qua về việc vì sao lãi suất tăng"*.
   * Tiêm lỗi: xoá bước `bao-ky-hop` ⇒ bài đầu đỏ; đổi lời `chuyen-v9` bỏ vế lý do ⇒ bài hai đỏ.
   */
  const luot = choiTron(KICH_BAN, 'theo_loi');
  const vongHien = new Map(luot.map((l) => [l.id, l.vong]));
  const loi = (id: string, v: number) => {
    const buoc = KICH_BAN.find((b) => b.id === id)!;
    return typeof buoc.loi === 'function' ? buoc.loi(dauVong(v)) : buoc.loi;
  };

  /*
   * D336 lượt 2 — founder 15/09: câu "bong bóng thật ⇒ tăng lãi để hạ nhiệt" *"hơi phiến diện, cần giải
   * thích rõ hơn và sát ngoài đời hơn"*. Vòng trước kỳ họp nay có HAI câu: kinh tế quá nóng là gì, và
   * ngân hàng trung ương canh LẠM PHÁT (không canh giá cổ phiếu). Tiêm lỗi: xoá `vi-sao-tang-lai` ⇒ đỏ.
   */
  /*
   * D433 — "vòng TRƯỚC" tính từ vòng QUYẾT TOÁN ô tăng lãi, không phải số của ô: luật ô úp (D382) quyết toán ô k ở
   * vòng k−1 (ô ấy còn úp suốt vòng đó). Báo trước = vòng trước vòng quyết toán.
   */
  const vongTang = ban.o.findIndex((o) => o.kind === 'su_kien' && o.su_kien === 'tang_lai_suat') + 1;
  const vongQuyet = vongTang - (luat.oUp ? 1 : 0);
  it('⭐⭐ vòng TRƯỚC vòng quyết toán ô tăng lãi, Oracle nói kỳ họp sắp tới VÀ vì sao kỳ họp hay tăng lãi', () => {
    expect(vongTang).toBeGreaterThan(2);
    expect(vongHien.get('bao-ky-hop')).toBe(vongQuyet - 1);
    expect(vongHien.get('vi-sao-tang-lai')).toBe(vongQuyet - 1);
    const hai = `${loi('bao-ky-hop', vongQuyet - 1)} ${loi('vi-sao-tang-lai', vongQuyet - 1)}`;
    expect(hai).toMatch(/KỲ HỌP/);
    expect(hai).toMatch(/QUÁ NÓNG/);
    expect(hai).toMatch(/LẠM PHÁT/);
    expect(hai).toMatch(/TĂNG LÃI/);
  });

  it('⭐⭐ vòng QUYẾT TOÁN ô tăng lãi: HỆ QUẢ lúc chốt (cả vế Đòn Bẩy) + công cụ RÚT; ô lật ra thì kể VÌ SAO vay đắt', () => {
    expect(loi('rui-ro-ky-hop', vongQuyet)).toMatch(/CHỐT/);
    expect(loi('rui-ro-ky-hop', vongQuyet)).toMatch(/ĐÒN BẨY/);
    expect(loi('rut', vongQuyet)).toMatch(/RÚT/);
    for (const id of ['rui-ro-ky-hop', 'rut']) expect(vongHien.get(id)).toBe(vongQuyet);
    expect(loi('chuyen-v9', vongTang)).toMatch(/vay đắt/);
    expect(vongHien.get('chuyen-v9')).toBe(vongTang);
  });

  /*
   * D336 lượt 2 — founder 15/09: *"cho oracle gợi ý user chọn đòn bẩy ở lõi 2 … kiểu giải thích rằng
   * tiền đang rẻ thì xu hướng dễ đi dài"*. Câu ở quầy lõi vòng 4 phải nói cả hai vế của lá (xu hướng dài
   * VÀ nhân cả lỗ) — nói một vế là khuyến khích, không phải giải thích.
   */
  it('⭐ quầy lõi thứ hai (vòng 4): tiền rẻ ⇒ xu hướng dài, ĐÒN BẨY nhân CẢ lãi lẫn lỗ', () => {
    expect(vongHien.get('loi-don-bay')).toBe(4);
    const c = loi('loi-don-bay', 4);
    expect(c).toMatch(/Tiền rẻ/);
    expect(c).toMatch(/DÀI/);
    expect(c).toMatch(/ĐÒN BẨY/);
    expect(c).toMatch(/lãi lẫn lỗ/);
  });

  it('⭐ A10 — mọi lời Oracle (mọi bước, mọi vòng) tả, không kê đơn', () => {
    const cam = ['bạn nên', 'hãy ', 'đừng ', 'tránh '];
    for (const b of KICH_BAN) {
      for (let v = 1; v <= SO_VONG; v += 1) {
        const c = (typeof b.loi === 'function' ? b.loi(dauVong(v)) : b.loi).toLowerCase();
        for (const t of cam) expect(c, `${b.id}: "${c}" chứa "${t}"`).not.toContain(t);
      }
    }
  });
});

// ─── V. GỢI Ý THU GỌN — Oracle có lời ở mọi trạng thái ──────────────────────
describe('V. Oracle thu gọn luôn có một câu, và câu ấy không kê đơn', () => {
  it('⭐ mọi bối cảnh vòng 1–12 (có/không shop, có/không tấm) đều ra một câu không rỗng', () => {
    for (let v = 1; v <= SO_VONG; v += 1) {
      for (const phu of [{}, { shopMo: true }, { moLyDo: true }, { toMo: true }, { bangDangMo: true }]) {
        const c = goiY({ ...dauVong(v), ...phu });
        expect(c.length, `vòng ${v} ${JSON.stringify(phu)}`).toBeGreaterThan(8);
        // A10 — tả chỗ bấm, không khuyên mua/bán/giữ.
        expect(c).not.toMatch(/\b(nên|hãy|đừng)\b/i);
      }
    }
  });
});

// ─── VI. LUẬT Ô ÚP — kể ô khi ô đã NGỬA, dự báo đúng vòng ô SẮP LẬT (D433) ───────
describe('VI. Luật ô úp: bước kể ô chỉ chạy khi ô đã ngửa; bước dự báo chạy đúng vòng ô ấy sắp lật', () => {
  /*
   * ⚠⚠ Vì sao có mục này (D433). Bàn tập lên v54 (ô úp, D382): ở vòng K, ô 1..K đã ngửa và cú CHỐT lật ô K+1.
   * Kịch bản v52 viết cho luật ngửa có câu "ô NÀY tính giá khi bạn CHỐT" ở chính vòng của ô — dưới ô úp, lúc ấy ô
   * đã lật từ đầu vòng và cú chốt lật ô KẾ. Mục II của `coach_ban_tap` khoá NỘI DUNG (lời ↔ ô), không khoá THỜI
   * ĐIỂM, nên cả bộ xanh trong khi Oracle kể sai nhân quả. Luật: `keO` thường ⇒ hiện ở vòng ≥ số ô; `keO.duBao`
   * ⇒ hiện ĐÚNG vòng ô ấy sắp lật (ô úp: ô − 1; luật ngửa: chính vòng của ô).
   */
  const vongHien = new Map(choiTron(KICH_BAN, 'theo_loi').map((l) => [l.id, l.vong]));
  const vongLat = (o: number) => (luat.oUp ? o - 1 : o);
  const saiThoiDiem = (kb: readonly Buoc[], hien: ReadonlyMap<string, number | 'ket'>): string[] => kb
    .filter((b) => b.keO !== undefined)
    .flatMap((b) => {
      const v = hien.get(b.id);
      if (typeof v !== 'number') return [`${b.id}: không hiện giữa trận`];
      const o = b.keO!.vong;
      if (b.keO!.duBao === true) {
        return v === vongLat(o) ? [] : [`${b.id}: dự báo ô ${o} mà hiện ở vòng ${v} (phải ${vongLat(o)})`];
      }
      return v >= o ? [] : [`${b.id}: kể ô ${o} ở vòng ${v}, lúc ô ấy còn úp`];
    });

  it('⭐ có cả hai loại bước (kể + dự báo) — rỗng một loại là bài này không canh gì', () => {
    expect(KICH_BAN.some((b) => b.keO !== undefined && b.keO.duBao !== true)).toBe(true);
    expect(KICH_BAN.some((b) => b.keO?.duBao === true)).toBe(true);
  });

  it('⭐⭐ mọi bước khai `keO` hiện đúng thời điểm của luật đang chạy', () => {
    expect(saiThoiDiem(KICH_BAN, vongHien)).toEqual([]);
  });

  it('⭐ tiêm ngược thường trực: đưa `rui-ro-ky-hop` về vòng 9 (chỗ của bản v52) ⇒ bài bắt được', () => {
    const hong = KICH_BAN.map((b) => (b.id === 'rui-ro-ky-hop'
      ? { ...b, cho: (x: BoiCanhTap) => x.vong === 9, troi: (x: BoiCanhTap) => x.vong > 9 } : b));
    const hien = new Map(choiTron(hong, 'theo_loi').map((l) => [l.id, l.vong]));
    expect(saiThoiDiem(hong, hien).some((x) => x.startsWith('rui-ro-ky-hop'))).toBe(true);
  });

  it('⭐ tiêm ngược thường trực: kể ô 4 (HẠ LÃI) ở vòng 3 mà không khai dự báo ⇒ bài bắt được', () => {
    const hong = KICH_BAN.map((b) => (b.id === 'du-bao-ky-hop'
      ? { ...b, keO: { vong: 4, su_kien: 'ha_lai_suat' } } : b));
    expect(saiThoiDiem(hong, vongHien).some((x) => x.startsWith('du-bao-ky-hop'))).toBe(true);
  });
});
