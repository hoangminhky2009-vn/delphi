/**
 * D527 — TRỢ LÝ BÀN TẬP MINIGAME (khoá v58, 6 ô · 5 vòng, nhịp T · M · T · M · M).
 *   §I   bàn tập thật mà kịch bản giả định (seed · dãy ô · quầy ghim · lịch) — dựng bằng đúng engine/config server dùng;
 *   §II  dòng thời gian: chạy trọn 5 vòng bằng `chonBuoc` (hàm component gọi), mọi bước mạch kể tới lượt đúng vòng — kể cả
 *        người làm trước khi được bảo (bài học "trợ lý chết câm", memory coach-buoc-kep-kin);
 *   §III lời: A10 (tả, không kê đơn) · không số tay · lời màn theo lõi khớp quầy ghim;
 *   §IV  dây nối: CoachTap chọn kịch bản theo cờ trận; màn trận truyền cờ + `tap` vào màn minigame.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GIAI_DOAN, HOLDEM_DECISIONS, NHIP_XEN_KE, SU_KIEN, TAI_SAN, boMaTranCua, luatCua, mtGiaiDoan, mtSuKien, nhipChonBai, seedManTap, soOManTap } from '@config/holdem';
import { tuyChonSinhMap } from '@server/holdem/engine';
import { sinhMap } from '@server/holdem/map';
import {
  KICH_BAN_MINIGAME, chonBuoc, loiCuaBuoc, type BoiCanhTap,
} from '../src/components/holdem/CoachTap';
import { LOI_MAN_DAU, loiOracleMan } from '../src/lib/coach_minigame';

const KHOA = HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION;
const luat = luatCua(KHOA);
const SO_O = soOManTap(luat);
const SO_VONG = SO_O - (luat.oUp ? 1 : 0);
const lich = NHIP_XEN_KE[SO_O]!;
const nhip = nhipChonBai(SO_O, luat.kyNgo, luat.gianLaMapNgan, true, true);
const ban = sinhMap(seedManTap(KHOA), SO_O, tuyChonSinhMap(luat));
const tenO = (o: (typeof ban.o)[number]) => (o.kind === 'su_kien' ? `!${o.su_kien}` : o.giai_doan);

describe('I. Bàn tập thật mà kịch bản giả định', () => {
  it('⭐ khoá v58 · 6 ô = 5 vòng · lõi chỉ vòng 1 · chợ đầu vòng 2 · 4 · màn sau 2 · 4 · 5', () => {
    expect([luat.nhipXenKe, luat.loiChiTrongMan], 'D530 — bàn tập theo luật trận thật: nhịp xen kẽ + lõi chỉ trong màn').toEqual([true, true]);
    expect([SO_O, SO_VONG]).toEqual([6, 5]);
    expect(nhip.map((x, i) => (x === 'chien_thuat' ? i + 1 : 0)).filter(Boolean)).toEqual([1]);
    expect(lich.trait).toEqual([2, 4]);
    expect(lich.man).toEqual([2, 4, 5]);
  });

  it('⭐ dãy ô của seed đúng như chú thích seed + lời trợ lý dựa vào (rơi → ⚖ hạ lãi → hồi → bong bóng): đổi seed hay luật sinh map ⇒ đỏ', () => {
    // D545 — khoá v62 (`kyHopBanTap`), seed `MAN_TAP_SEED_KY_HOP`: kỳ họp cố định ô 3.
    expect(luat.kyHopBanTap).toBe(true);
    expect(seedManTap(KHOA)).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP);
    expect(ban.o.map(tenO)).toEqual(['giam', 'giam', '!ha_lai_suat', 'phuc_hoi', '!bong_bong', 'tang']);
  });

  it('⭐ quầy lõi vòng 1 ghim đúng hai lõi trợ lý gọi tên', () => {
    expect([...HOLDEM_DECISIONS.MAN_TAP_LOI_XEN_KE[1]!]).toEqual(['bat_day', 'don_bay']);
    const loi = loiCuaBuoc(KICH_BAN_MINIGAME.find((b) => b.id === 'mg-loi')!, {} as BoiCanhTap);
    expect(loi).toContain('BẮT ĐÁY');
    expect(loi).toContain('ĐÒN BẨY');
  });
});

/* ─── II. DÒNG THỜI GIAN ───────────────────────────────────────────────────────────────────────────────────────────────── */

function dauVong(v: number): BoiCanhTap {
  return {
    vong: v, tongVong: SO_VONG, minigame: true,
    shopMo: false, bangMo: false, shopChonMa: false, shopCoLenh: false,
    coKetQua: v > 1, sanKhau: false,
    loaiVongNay: nhip[v - 1] ?? 'khong', coChoTrait: lich.trait.includes(v),
    xong: false, onMoShop: () => {},
    moLyDo: false, chonLoi: false, tamMo: null,
    chaoVaiXong: v === 1 ? false : true, chaoVaiPha: v === 1 ? 'chia' : null,
  };
}

const LAM: Record<string, (b: BoiCanhTap) => void> = {
  'mg-chia-vai': (b) => { b.chaoVaiPha = 'toi'; },
  'mg-vai-cua-ban': (b) => { b.chaoVaiXong = true; b.chaoVaiPha = null; },
  'mg-mo-shop': (b) => { b.shopMo = true; },
  'mg-loi': (b) => { b.chonLoi = true; },
  'mg-lenh': (b) => { b.shopCoLenh = true; },
  'mg-chot': (b) => { b.shopMo = false; },
  'mg-vi-sao': (b) => { b.moLyDo = true; },
};

function choiTron(kieu: 'theo_loi' | 'lam_truoc'): { vong: number | 'ket'; id: string }[] {
  const daQua = new Set<string>(), daHien = new Set<string>();
  const hien: { vong: number | 'ket'; id: string }[] = [];
  for (let v = 1; v <= SO_VONG; v += 1) {
    const b = dauVong(v);
    if (kieu === 'lam_truoc' && v === 1) { b.chaoVaiXong = true; b.chaoVaiPha = null; b.shopMo = true; b.chonLoi = true; }
    for (let n = 0; ; n += 1) {
      if (n > 40) throw new Error(`vòng ${v}: trợ lý quay vòng vô hạn`);
      const { buoc, ghi } = chonBuoc(KICH_BAN_MINIGAME, daQua, b, daHien);
      for (const id of ghi) daQua.add(id);
      if (!buoc) break;
      if (!hien.some((h) => h.id === buoc.id)) hien.push({ vong: v, id: buoc.id });
      if (buoc.shop !== undefined) b.shopMo = buoc.shop;
      if (buoc.lyDo !== undefined) b.moLyDo = buoc.lyDo;
      const xong = buoc.tuXong?.(b) === true;
      if (!xong) daHien.add(buoc.id);
      const lam = LAM[buoc.id];
      if (!buoc.tuXong || xong || buoc.tiep) daQua.add(buoc.id);   // bước đọc ⇒ bấm TIẾP
      else if (lam) lam(b);
      else daQua.add(buoc.id);
    }
  }
  const ket: BoiCanhTap = { ...dauVong(SO_VONG), vong: SO_VONG + 1, xong: true, coKetQua: false };
  for (let i = 0; i < 4; i += 1) {
    const { buoc, ghi } = chonBuoc(KICH_BAN_MINIGAME, daQua, ket);
    for (const id of ghi) daQua.add(id);
    if (!buoc) break;
    hien.push({ vong: 'ket', id: buoc.id });
    daQua.add(buoc.id);
  }
  return hien;
}

const VONG_CUA: Readonly<Record<string, number | 'ket'>> = {
  'mg-chia-vai': 1, 'mg-vai-cua-ban': 1, 'mg-nhip': 1, 'mg-mo-shop': 1, 'mg-loi': 1, 'mg-lenh': 1, 'mg-chot': 1,
  'mg-lat': 2, 'mg-du-bao-ky-hop': 2, 'mg-trait': 2, 'mg-ky-hop': 3, 'mg-tien-khong-re-mai': 3, 'mg-tu-choi': 3, 'mg-vi-sao': 3, 'mg-phuc-hoi': 4, 'mg-trait-2': 4,
  'mg-bong-bong': 5, 'mg-cuoi': 5, 'mg-het': 'ket',
};

describe('II. Dòng thời gian — trọn 5 vòng', () => {
  it('⭐ bảng vòng phủ ĐÚNG mọi bước của kịch bản (thêm bước mà quên khai ⇒ đỏ)', () => {
    expect(Object.keys(VONG_CUA).sort()).toEqual(KICH_BAN_MINIGAME.map((b) => b.id).sort());
  });

  it('⭐⭐ người làm theo lời: MỌI bước hiện, đúng vòng của nó, đúng thứ tự khai', () => {
    const hien = choiTron('theo_loi');
    expect(hien.map((h) => h.id)).toEqual(KICH_BAN_MINIGAME.map((b) => b.id));
    for (const h of hien) expect(h.vong, h.id).toBe(VONG_CUA[h.id]);
  });

  it('⭐ người làm TRƯỚC khi được bảo (shop mở sẵn, lõi lấy sẵn): trợ lý không chết câm — mọi bước từ vòng 2 vẫn tới', () => {
    const ids = new Set(choiTron('lam_truoc').map((h) => h.id));
    for (const id of ['mg-lat', 'mg-trait', 'mg-vi-sao', 'mg-trait-2', 'mg-cuoi', 'mg-het']) expect(ids, id).toContain(id);
  });

  it('mọi bước mạch kể có `troi` (không bước nào đứng chặn cả bàn khi bối cảnh đã qua)', () => {
    for (const b of KICH_BAN_MINIGAME) if (b.lan !== 'khi' && b.ket !== true) expect(b.troi, b.id).toBeDefined();
  });
});

/* ─── III. LỜI ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

const TU_CAM = ['nên ', 'hãy ', 'đừng ', 'phải ', 'cần ', 'Nên ', 'Hãy ', 'Đừng '];
const moiLoi = (): string[] => [
  ...KICH_BAN_MINIGAME.map((b) => loiCuaBuoc(b, dauVong(1))),
  LOI_MAN_DAU,
  ...[4, 5].flatMap((v) => ['bat_day', 'don_bay', 'mua_duoi'].map((la) => loiOracleMan(v, la) ?? '')),
];

describe('III. Lời', () => {
  it('⭐ A10 — tả, không kê đơn: không một từ cấm nào trong mọi lời của bàn tập minigame', () => {
    for (const loi of moiLoi()) for (const tu of TU_CAM) expect(loi.includes(tu), `"${tu}" trong: ${loi}`).toBe(false);
  });

  it('không in số tiền / phần trăm gõ tay (số đổi theo tham số — để màn nói)', () => {
    for (const loi of moiLoi()) expect(loi, loi).not.toMatch(/\d+\s*%|\d{3,}/);
  });

  it('⭐ lời màn: màn đầu luật chung (giữ suốt thì khoản VẪN chạy theo giá — không đọc thành "đứng im"); màn 4 · 5 theo lõi; lõi lạ im', () => {
    expect(loiOracleMan(2, null)).toBe(LOI_MAN_DAU);
    expect(LOI_MAN_DAU).toContain('khoản đi đúng theo giá');
    expect(LOI_MAN_DAU).not.toContain('cộng không');
    expect(loiOracleMan(4, 'bat_day')).toContain('ĐƯỜNG GIÁ TRỊ');
    expect(loiOracleMan(5, 'bat_day')).toContain('QUÁ BÁN');
    expect(loiOracleMan(4, 'don_bay')).toContain('GỌI');
    expect(loiOracleMan(4, 'mua_duoi')).toBeNull();
    // Hai lõi có lời theo lõi = đúng hai lõi trên quầy ghim.
    for (const la of HOLDEM_DECISIONS.MAN_TAP_LOI_XEN_KE[1]!) expect(loiOracleMan(4, la), la).not.toBeNull();
  });
});

/* ─── IV. DÂY NỐI ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

const doc = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('IV. Dây nối', () => {
  it('⭐ CoachTap chọn kịch bản theo cờ trận `minigame`, không theo hằng bàn tập', () => {
    expect(doc('src/components/holdem/CoachTap.tsx')).toMatch(/chonBuoc\(b\.minigame \? KICH_BAN_MINIGAME : KICH_BAN,/);
  });

  it('⭐ màn trận truyền cờ minigame + chợ trait vào trợ lý, và `tap` vào màn minigame', () => {
    const src = doc('src/screens/holdem/AlphaDraftMatch.tsx');
    expect(src.match(/minigame=\{st\.dong_ho_minigame === true\}/g)?.length, 'cả trợ lý trên bàn lẫn trên màn kết').toBe(2);
    expect(src).toContain('coChoTrait={!!choTrait && choTrait.vong === st.vong}');
    expect(src).toMatch(/<ManMinigame[^>]*tap=\{laManTap\}/);
  });
});

/* ─── V. D545 — LỜI ↔ BÀN THẬT ↔ MA TRẬN ──────────────────────────────────────────────────────────────────────────────── */
/*
 * Từ vòng 3 Oracle chỉ còn KỂ ô vừa lật (founder 06/10). Lời kể sai ô / sai phe là dạy sai — hai khoá như `coach_ban_tap` (II · XI) nhưng cho
 * kịch bản minigame: `keO` ⇔ ô thật của seed bàn tập · `noiChieu` ⇔ dấu trong ma trận của khoá bàn tập; lời gọi đúng tên ô + tên phe nó khai.
 */
describe('V. D545 — Oracle kể đúng ô thật và đúng phe lên xuống', () => {
  const coKeO = KICH_BAN_MINIGAME.filter((b) => b.keO !== undefined);
  it('⭐ đủ bốn mốc kể: GIẢM · ⚖ HẠ LÃI (báo trước + vừa lật) · PHỤC HỒI · BONG BÓNG', () => {
    const moc = coKeO.map((b) => `${b.keO!.su_kien ?? b.keO!.giai_doan}${b.keO!.duBao ? '?' : ''}`);
    for (const m of ['giam', 'ha_lai_suat?', 'ha_lai_suat', 'phuc_hoi', 'bong_bong']) expect(moc, m).toContain(m);
  });
  for (const b of coKeO) {
    it(`${b.id} — ô ${b.keO!.vong} thật khớp keO, lời gọi đúng tên ô`, () => {
      const o = ban.o[b.keO!.vong - 1]!;
      const id = o.kind === 'su_kien' ? o.su_kien : o.giai_doan;
      expect(id).toBe(b.keO!.su_kien ?? b.keO!.giai_doan);
      if (o.kind === 'su_kien' && b.keO!.la_tin_gia !== undefined) expect(o.la_tin_gia).toBe(b.keO!.la_tin_gia);
      const ten = (o.kind === 'su_kien' ? SU_KIEN.find((x) => x.id === id)?.label : GIAI_DOAN.find((x) => x.id === id)?.label) ?? '';
      const loi = loiCuaBuoc(b, dauVong(b.keO!.vong)).toLocaleUpperCase('vi-VN');
      // Bước báo trước (`duBao`) nói KỲ HỌP + hướng hay gặp; bước vừa lật gọi đúng tên ô.
      expect(loi).toContain(b.keO!.duBao ? 'KỲ HỌP' : ten.toLocaleUpperCase('vi-VN'));
    });
  }
  const bo = boMaTranCua({ lop_vn: luat.lopVn, tai_san_v42: luat.taiSanV42 });
  const mtSk = mtSuKien(bo), mtGd = mtGiaiDoan(bo);
  const maCua = (x: string) => (x === 'rui_ro' || x === 'phong_thu' ? TAI_SAN.filter((t) => t.nhom === x).map((t) => t.id) : [x]);
  const tenCua = (x: string) => (x === 'rui_ro' ? 'RỦI RO' : x === 'phong_thu' ? 'PHÒNG THỦ'
    : (TAI_SAN.find((t) => t.id === x)?.label ?? x).split(' ').slice(0, 2).join(' ').toLocaleUpperCase('vi-VN'));
  for (const b of KICH_BAN_MINIGAME.filter((x) => (x.noiChieu?.length ?? 0) > 0)) {
    it(`${b.id} — phe/mã khai lên xuống đúng dấu ma trận, và lời gọi tên chúng`, () => {
      const loi = loiCuaBuoc(b, dauVong(3)).toLocaleUpperCase('vi-VN');
      for (const n of b.noiChieu!) {
        const hang = (ma: string) => (n.su_kien !== undefined ? (mtSk as any)[ma]?.[n.su_kien] : (mtGd as any)[ma]?.[n.giai_doan!]) as number;
        for (const x of n.len ?? []) { for (const ma of maCua(x)) expect(hang(ma), `${b.id}: ${ma} LÊN?`).toBeGreaterThan(0); expect(loi).toContain(tenCua(x)); }
        for (const x of n.xuong ?? []) { for (const ma of maCua(x)) expect(hang(ma), `${b.id}: ${ma} XUỐNG?`).toBeLessThan(0); expect(loi).toContain(tenCua(x)); }
      }
    });
  }
  /*
   * D546 (founder 07/10) — ba ý nội dung phải còn trong lời: hạ lãi là LỰA CHỌN kích cầu, không phải phản xạ "chợ giảm ⇒ hạ"; hạ lãi = tiền chảy
   * vào nền kinh tế; bong bóng nói cơ chế (vay mua · thanh lý dây chuyền) và hai đường vỡ (cú sốc · ngân hàng TĂNG lãi) — khớp engine.
   */
  it('⭐ D546 — kỳ họp là lựa chọn kích cầu, hạ lãi = tiền chảy vào nền kinh tế, bong bóng có cơ chế + đường vỡ', () => {
    const loiCua = (id: string) => { const b = KICH_BAN_MINIGAME.find((x) => x.id === id)!; return loiCuaBuoc(b, dauVong(b.keO?.vong ?? 3)).toLocaleUpperCase('vi-VN'); };
    const duBao = loiCua('mg-du-bao-ky-hop');
    expect(duBao).toContain('LỰA CHỌN CHÍNH SÁCH');
    expect(duBao).toContain('KÍCH CẦU');
    expect(duBao, 'không dạy "chợ giảm thì ngân hàng hạ" như quy luật').not.toMatch(/ĐỂ ĐỠ CHỢ/);
    expect(loiCua('mg-ky-hop')).toContain('TIỀN CHẢY VÀO NỀN KINH TẾ');
    const bb = loiCua('mg-bong-bong');
    for (const y of ['VAY', 'THANH LÝ', 'CÚ SỐC', 'TĂNG LÃI']) expect(bb, y).toContain(y);
  });
  /*
   * D454 (founder 29/09) — cảnh báo TIỀN RẺ phải nói TRƯỚC khi Oracle thôi dắt (`mg-tu-choi`) và SAU khi thẻ hạ lãi vừa lật (`mg-ky-hop`): đứng sau
   * "tự chơi" là Oracle nói tiếp sau khi hứa im. Đủ ba ý founder đặt; không vẽ lá (bàn tập không có lá LẠM PHÁT — vẽ ra là hứa một lá không tới).
   */
  it('⭐ D454 — sau thẻ hạ lãi, trước khi thôi dắt: tiền rẻ đẻ LẠM PHÁT · ngân hàng cân bằng lại (nâng lãi) trước khi quá xa · không rẻ mãi', () => {
    const ids = KICH_BAN_MINIGAME.map((x) => x.id);
    expect(ids.indexOf('mg-tien-khong-re-mai'), 'ngay sau kỳ họp vừa lật').toBe(ids.indexOf('mg-ky-hop') + 1);
    expect(ids.indexOf('mg-tien-khong-re-mai'), 'trước "từ vòng này bạn tự chơi"').toBeLessThan(ids.indexOf('mg-tu-choi'));
    const b = KICH_BAN_MINIGAME.find((x) => x.id === 'mg-tien-khong-re-mai')!;
    const loi = loiCuaBuoc(b, dauVong(3)).toLocaleUpperCase('vi-VN');
    for (const y of ['KHÔNG RẺ MÃI', 'LẠM PHÁT', 'NGÂN HÀNG SẼ CÂN BẰNG LẠI', 'NÂNG LÃI', 'QUÁ XA']) expect(loi, y).toContain(y);
    expect([b.hinh, b.keO, b.noiChieu], 'không vẽ lá, không khoá ô').toEqual([undefined, undefined, undefined]);
  });
  it('bước vẽ dải MỨC một tin thì khai chiều của chính tin ấy', () => {
    for (const b of KICH_BAN_MINIGAME) if (b.hinh?.loai === 'su_kien') expect(b.noiChieu?.some((n) => n.su_kien === (b.hinh as { id: string }).id), b.id).toBe(true);
  });
});
