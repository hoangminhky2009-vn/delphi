/**
 * QUYẾT TOÁN MÀN VÀO NAV — hàm THUẦN (D475, bước 4 #1).
 *
 * Màn của vòng v chạy ở ĐẦU vòng v + 1 (D473). Kết quả của nó (demo `moQuyetToan`: "khoản sau = vốn + thị trường + nhờ lõi") cộng vào KHOẢN
 * của mã đã chơi: `vi_the[mã] += lãi lỗ màn` (sàn 0 — lỗ đã có trần = cả khoản). Áp ở ĐÚNG MỘT chỗ trong chuỗi vòng: đầu vòng v + 1, trước mọi
 * thao tác của vòng đó — hai đường cùng một chỗ:
 *   · vòng v + 1 ĐANG chơi: đuôi `manCho` của replay (chỉ khi màn đã hết giờ);
 *   · vòng v + 1 ĐÃ nộp: trường `mg` của dòng log vòng v + 1 — SỐ NGUYÊN do server tính lúc nộp, bằng chính hàm dưới đây.
 * Nên người chơi đặt lệnh vòng v + 1 trên NAV đã gồm màn, và replay sau nộp ra cùng NAV ấy.
 */
import { laiSuatLuc, maVaoGia, vongXetVaoGia, type Ghe, type TrangThaiTran } from '../engine.js';
import { traitHieuLuc } from '../trait.js';
import { HE_DON_BAY_VAI, K_MIN, MA_MINIGAME, NEN_LS, SO_NHIP, TU_DAY } from '../../../config/minigame.js';
import { RAI_LENH_NEN } from '../../../config/trait.js';
import { boiCanhMan, damDongCua, duongPhuCua, dungDongMan, dungDongManDu, lenhXemMa, type BoiCanhMan } from './man.js';
import { apXungBan, apXungMang, cuaSoTrait, ketQuaMan, laCuaMan, lenhBotBatDay, MA_TIEN_MAT, type KetQuaMan, type LenhMan, type XungBan } from './khop.js';
import { LOI_BAN_KHONG, LOI_DON_BAY, mucLaiVay } from './tien.js';
import { LUA } from '../../../config/lua.js';

/** Kết quả màn đầy đủ của ghế người chơi, kèm mã + vốn màn (màn KẾT QUẢ / QUYẾT TOÁN). */
export type KetQuaManGhe = KetQuaMan & { ma: string; von: number; von_sau: number };

/**
 * Kết quả màn của một ghế: mã đã chơi + lãi lỗ (chip, nguyên). D492 — `nap`: khoản KHÁC đã bán để NẠP ký quỹ lõi Đòn Bẩy (mã → chip trừ);
 * phần nhận (sau phí) đã nằm trong `loi`. ⚠ Chỉ THÊM trường (dòng log `mg` là cửa một chiều).
 */
/** `het` — D507: mã bị BÁN HẾT bán TRỌN (founder: "round sau … ko còn chip nào ở các tài sản kia nữa") ⇒ quyết toán đặt khoản về 0, không chỉ trừ `nap`. */
export interface MgGhe {
  ma: string; loi: number; nap?: Readonly<Record<string, number>>; het?: readonly string[];
  /**
   * D530 — XU NHIỆM VỤ LÕI dời vào màn (founder 06/10: *"Tính theo lãi lỗ hơn giữ"*): khoá `loiChiTrongMan` + `nhiemVuLoi`, ghế CÓ lõi đang chơi mà
   * kết quả màn hơn giữ suốt (`loi` > 0) ⇒ +`LUA.XU_NHIEM_VU_LOI`. Ghi vào dòng màn lúc quyết toán ⇒ replay đọc lại; dòng cũ vắng trường ⇒ +0.
   */
  xu?: number;
  /** D561 — khoá v65 (`nhieuMa`): lãi lỗ màn của từng MÀN CON (mã khác mã chính), áp như `loi` vào đúng khoản. Dòng cũ vắng ⇒ không có. */
  them?: readonly { ma: string; loi: number }[];
}
export type MgVong = Readonly<Record<string, MgGhe>>;

/** D482 — đòn bẩy trong màn của một ghế: mang trait ghim ĐÒN BẨY (`don_bay_man`, cặp Cá mập dưới `traitGhimMinigame`) ⇒ `HE_DON_BAY_VAI`. */
export function heManCua(st: TrangThaiTran, g: Pick<Ghe, 'vai' | 'trait'>): number {
  return traitHieuLuc(st, g).includes('don_bay_man') ? HE_DON_BAY_VAI : 1;
}

/** D483 — ghế mang trait TUNG TIN (cặp Đội lái dưới `traitGhimMinigame`). */
export function coTungTin(st: TrangThaiTran, g: Pick<Ghe, 'vai' | 'trait'>): boolean {
  return traitHieuLuc(st, g).includes('tung_tin');
}

/** Bối cảnh màn của một ghế ở vòng `vong` — MỘT nguồn cho cửa mở màn (người) và quyết toán (người chưa mở màn + bot). */
export function boiCanhGhe(
  st: TrangThaiTran, seedTran: number, vong: number, viThe: Readonly<Record<string, number>>,
  /** D479 — % thị trường công khai của vòng `vong` (engine `loiSuatCong`): neo điểm cuối đường giá + tách vốn màn. */
  loiSuat: Readonly<Record<string, number>> | null,
  /** D482 — đòn bẩy trong màn của ghế (`heManCua`). */
  he?: number,
  /** D483 — ghế mang trait TUNG TIN (`coTungTin`). */
  tungTin?: boolean,
  /** D486 — trait trong màn của ghế. */
  traitMan?: { kienNhan?: boolean; nongVoi?: boolean },
  /** D494 — mã các ghế KHÁC đang cầm lõi Đòn Bẩy giữ (`maDongDonBay`). */
  dbKhac?: readonly string[],
  /** D499 — tự đẩy giá + Rải lệnh + Tổ Chức của ghế (`vaiManCua`). */
  vaiMan?: { tuDayVai?: number; rai?: number; toChuc?: boolean },
  /** D507 — tiền mặt của ghế (nguồn nạp Tiền mặt của lõi Đòn Bẩy). */
  tienMat?: number,
  /** D512 — mã các ghế KHÁC cầm lõi Bán Khống giữ (`maDongKhong`). */
  bkKhac?: readonly string[],
  /** D517 — số ghế Cá nhân KHÁC giữ từng mã (`soCaNhanCung`); vắng = không bầy. */
  caNhanKhac?: Readonly<Record<string, number>>,
  /** D528 — trait trong màn của khoá v59 (`traitManV59`). */
  v59?: { keMua?: boolean; keBan?: boolean; tamLyYeu?: boolean; tranThuaGiu?: boolean },
  /** D536 — vai lớn của các ghế bot KHÁC giữ từng mã (`vaiLonCung`); vắng = khoá không có lệnh lớn. */
  vaiLonKhac?: Readonly<Record<string, readonly ('ca_map' | 'doi_lai')[]>>,
) {
  return boiCanhMan({
    seedTran, vong, map: st.map, oUp: st.o_up === true, viThe, loiSuat, ...(he !== undefined ? { he } : {}), ...(tungTin ? { tungTin } : {}),
    ...(traitMan?.kienNhan ? { kienNhan: true } : {}), ...(traitMan?.nongVoi ? { nongVoi: true } : {}),
    ...(st.beta_tai_san_v2 === true ? { betaV2: true } : {}),
    ...(dbKhac?.length ? { dbKhac } : {}),
    ...(vaiMan?.tuDayVai ? { tuDayVai: vaiMan.tuDayVai } : {}), ...(vaiMan?.rai ? { rai: vaiMan.rai } : {}), ...(vaiMan?.toChuc ? { toChuc: true } : {}),
    ...(tienMat !== undefined ? { tienMat } : {}),   // D507
    ...(bkKhac?.length ? { bkKhac } : {}),   // D512
    ...(caNhanKhac ? { caNhanKhac } : {}),   // D517
    ...(v59 ?? {}),   // D528
    ...(vaiLonKhac ? { vaiLonKhac } : {}),   // D536   // D487 — ρ bảng phụ đọc CÙNG bảng β engine
    laiSuatDiem: laiSuatLuc({ ...st, vong }), namNac: st.thanh_khoan_nam_nac === true,   // D470 — cùng tham số chốt vòng
    ...(st.ban_khong_x2 === true ? { bkX2: true } : {}),   // D561
    ...(st.ban_bot_bd_md === true ? { banBot: true } : {}),   // D561
    ...(st.ban_bot_rai === true ? { banBotRai: true } : {}),   // D586
    ...(st.ba_phan === true ? { baPhan: true } : {}),   // D589
    ...(st.khoan_theo_duong === true ? { khoanTheoDuong: true } : {}),   // D561
    ...(st.up_la_pha === true ? { upLaPha: true } : {}),   // D561
    ...((() => { const o = st.map.o[st.o_up === true ? vong : vong - 1];   // D561 — vòng xét "đã vào giá": danh sách mã bị đảo (một nguồn với engine)
      return vongXetVaoGia(st, vong, o) ? { vaoGiaMa: [...maVaoGia(st, vong, o)] } : {}; })()),
  });
}

/**
 * D561 — bối cảnh màn của GHẾ NGƯỜI. Khoá `nhieu_ma`: màn chính = khoản lớn nhất (nguồn nạp Đòn Bẩy chỉ còn TIỀN MẶT — khoản khác đã có màn của
 * riêng nó, nạp từ nó là tiêu hai lần), mỗi khoản khác có dòng giá một MÀN CON vốn = cả khoản (founder 08/10). Màn con không mang Tâm lý yếu / trần
 * thua Tổ Chức / Tung tin — các luật ấy vẫn chỉ đè lên khoản chính như trước (đổi thêm là đổi kinh tế chưa đo). Khoá cũ ⇒ `boiCanhCuaGhe` y nguyên.
 */
export function boiCanhNguoi(
  st: TrangThaiTran, seedTran: number, vong: number, g: Pick<Ghe, 'id' | 'vi_the' | 'vai' | 'trait'> & Partial<Pick<Ghe, 'von'>>, loiSuat: Readonly<Record<string, number>> | null,
): ReturnType<typeof boiCanhCuaGhe> {
  const bc = boiCanhCuaGhe(st, seedTran, vong, g, loiSuat);
  if (st.nhieu_ma !== true || 'loi' in bc) return bc;
  const chinh = boiCanhCuaGhe(st, seedTran, vong, { ...g, vi_the: { [bc.ma]: g.vi_the[bc.ma]! } }, loiSuat);
  if ('loi' in chinh) return bc;
  const nhieu: BoiCanhMan[] = [];
  const khac = Object.entries(g.vi_the).filter(([x, v]) => x !== bc.ma && v > 0 && MA_MINIGAME[x]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (const [ma, v] of khac) {
    const x = boiCanhCuaGhe(st, seedTran, vong, { ...g, vi_the: { [ma]: v }, von: 0 }, loiSuat);
    if ('loi' in x) continue;
    const { tam_ly_yeu: _a, tran_thua_giu: _b, tung_tin: _c, ...con } = x;
    nhieu.push(con);
  }
  return { ...chinh, ...(nhieu.length ? { nhieu } : {}) };
}

/**
 * D483 — bối cảnh màn của MỘT GHẾ, đủ thứ của ghế (vị thế · đòn bẩy trait ghim · TUNG TIN). MỘT cửa cho cửa mở màn (người) và quyết toán (bot +
 * người chưa mở màn) — hai chỗ tự ghép tham số là có ngày một chỗ quên trait.
 */
export function boiCanhCuaGhe(
  st: TrangThaiTran, seedTran: number, vong: number, g: Pick<Ghe, 'id' | 'vi_the' | 'vai' | 'trait'> & Partial<Pick<Ghe, 'von'>>, loiSuat: Readonly<Record<string, number>> | null,
) {
  const tr = traitHieuLuc(st, g);
  return boiCanhGhe(st, seedTran, vong, g.vi_the, loiSuat, heManCua(st, g), coTungTin(st, g), { kienNhan: tr.includes('kien_nhan'), nongVoi: tr.includes('nong_voi') },
    maDongDonBay(st, g.id), vaiManCua(st, g), g.von, maDongLoi(st, g.id, LOI_BAN_KHONG),
    st.bay_ca_nhan_v57 === true ? soCaNhanCung(st, g.id) : undefined, traitManV59(st, g, tr),
    st.lenh_lon_v61 === true ? vaiLonCung(st, g.id) : undefined);
}

/**
 * D536 — vai lớn (Cá Mập · Đội Lái) của các ghế BOT khác còn sống giữ > 0 từng mã: mỗi vai một lần, thứ tự cố định. Ghế NGƯỜI không tính — lệnh thật của
 * người đè lên màn bot qua cú tự đẩy (`tinhMgCaBan`, D507), không qua kịch bản này. Chính ghế không tính.
 */
export function vaiLonCung(st: TrangThaiTran, id: string): Record<string, ('ca_map' | 'doi_lai')[]> {
  const ra: Record<string, ('ca_map' | 'doi_lai')[]> = {};
  for (const vai of ['ca_map', 'doi_lai'] as const) {
    for (const x of st.ghe) {
      if (x.id === id || x.id === 'ban' || x.da_chay || x.vai !== vai) continue;
      for (const [ma, v] of Object.entries(x.vi_the)) if (v > 0 && !(ra[ma] ??= []).includes(vai)) ra[ma]!.push(vai);
    }
  }
  return ra;
}

/**
 * D528 (cờ `ke_lenh_v59`) — trait trong màn của khoá v59: KÊ MUA · KÊ BÁN · TÂM LÝ YẾU · trần thua Tổ Chức áp khoản giữ (mọi ghế Tổ Chức). Khoá cũ ⇒ rỗng.
 */
export function traitManV59(st: TrangThaiTran, g: Pick<Ghe, 'vai' | 'trait'>, tr = traitHieuLuc(st, g)): { keMua?: boolean; keBan?: boolean; tamLyYeu?: boolean; tranThuaGiu?: boolean; luotSong?: boolean; tinMan?: boolean; muTin?: boolean } {
  if (st.ke_lenh_v59 !== true) return {};
  return {
    ...(st.loi_chi_trong_man === true ? { luotSong: true } : {}),   // D531 — khoá v60: lõi Lướt Sóng có nút trong màn (cùng ống với trait màn v59)
    // D532 — khoá v60: màn có dòng TIN (bong bóng) · ghế mang MÙ TIN thì chữ bị che + không mua tin sớm được.
    ...(st.loi_chi_trong_man === true ? { tinMan: true, ...(tr.includes('mu_tin') ? { muTin: true } : {}) } : {}),
    ...(tr.includes('ke_mua') ? { keMua: true } : {}), ...(tr.includes('ke_ban') ? { keBan: true } : {}),
    ...(tr.includes('tam_ly_yeu') ? { tamLyYeu: true } : {}), ...(g.vai === 'to_chuc' ? { tranThuaGiu: true } : {}),
  };
}

/**
 * D517 — số ghế CÁ NHÂN khác (còn sống, bot hay người) giữ > 0 từng mã: thành viên BẦY CÁ NHÂN của màn trên mã đó (founder: "Bot cá nhân ko được tính
 * ư mà phải đợi người thật?" — được tính). Chính ghế không tính: cú bấm thật của mình đi đường khớp riêng.
 */
export function soCaNhanCung(st: TrangThaiTran, id: string): Record<string, number> {
  const ra: Record<string, number> = {};
  for (const x of st.ghe) {
    if (x.id === id || x.da_chay || x.vai !== 'ca_nhan') continue;
    for (const [ma, v] of Object.entries(x.vi_the)) if (v > 0) ra[ma] = (ra[ma] ?? 0) + 1;
  }
  return ra;
}

/**
 * D499 (cờ `toChucV57`) — phần màn của VAI: hệ số tự đẩy giá theo vai (Cá nhân 0) · cấp RẢI LỆNH đang mang · ghế TỔ CHỨC. Khoá cũ ⇒ rỗng (byte-hệt).
 */
export function vaiManCua(st: TrangThaiTran, g: Pick<Ghe, 'vai' | 'trait'>): { tuDayVai?: number; rai?: number; toChuc?: boolean } {
  if (st.to_chuc_v57 !== true || st.vai_co_rang !== true || !g.vai) return {};
  const rai = traitHieuLuc(st, g).map((t) => RAI_LENH_NEN[t] ?? 0).reduce((a, x) => Math.max(a, x), 0);
  return { tuDayVai: TU_DAY.VAI[g.vai] ?? 0, ...(rai ? { rai } : {}), ...(g.vai === 'to_chuc' ? { toChuc: true } : {}) };
}

/**
 * D494 — mã mà các ghế KHÁC (còn sống) đang cầm lõi Đòn Bẩy giữ > 0: màn của ghế `id` trên một trong các mã này có đám đông đòn bẩy cùng mã
 * ("cùng map" của demo bản 32) ⇒ thanh lý dây chuyền.
 */
export function maDongDonBay(st: TrangThaiTran, id: string): string[] {
  return maDongLoi(st, id, LOI_DON_BAY);
}
/** D512 — mã mà các ghế KHÁC (còn sống) đang cầm lõi `loi` giữ > 0 (Đòn Bẩy ⇒ đám đông vay mua · Bán Khống ⇒ đám đông bán khống cùng map). */
export function maDongLoi(st: TrangThaiTran, id: string, loi: string): string[] {
  const ra = new Set<string>();
  for (const x of st.ghe) {
    if (x.id === id || x.da_chay || !(x.danh_muc.chien_thuat as readonly string[]).includes(loi)) continue;
    for (const [ma, v] of Object.entries(x.vi_the)) if (v > 0) ra.add(ma);
  }
  return [...ra].sort();
}

/**
 * Tham số khớp lấy từ bối cảnh màn — MỘT nguồn cho quyết toán và sổ giữa màn (cửa `/lenh`): vốn · mã · nấc · đòn bẩy ghế · TUNG TIN · D492 lãi vay +
 * nguồn nạp của lõi Đòn Bẩy.
 */
export function thamSoKhop(bc: BoiCanhMan) {
  return {
    ...(bc.tu_day_vai ? { tuDayVai: bc.tu_day_vai } : {}), ...(bc.nap_tu ? { giaKhoan: giaKhoanCua(bc) } : {}),   // D507 — BÁN HẾT
    von: bc.von, ma: bc.ma, ...(bc.nac ? { nac: bc.nac } : {}), ...(bc.he ? { he: bc.he } : {}), ...(bc.tung_tin ? { tungTin: true } : {}),
    laiVayPct: mucLaiVay(bc.kb.o, bc.dai), ...(bc.nap_tu ? { napTu: bc.nap_tu } : {}),
    ...(bc.tu_day ? { tuDay: bc.tu_day } : {}), ...(bc.rai ? { rai: bc.rai } : {}), ...(bc.to_chuc ? { toChuc: true } : {}),   // D499
    ...(bc.ke ? { ke: bc.ke } : {}), ...(bc.tam_ly_yeu ? { tamLyYeu: true } : {}), ...(bc.tran_thua_giu ? { tranThuaGiu: true } : {}),   // D528
    ...(bc.luot_song ? { luotSong: true } : {}),   // D531
    ...(bc.bk_x2 ? { bk_x2: true as const } : {}),   // D561
    ...(bc.ban_bot ? { banBot: true } : {}),   // D561
    ...(bc.ban_bot_rai ? { banBotRai: true } : {}),   // D586
    ...(bc.ba_phan ? { baPhan: true } : {}),   // D589
    ...(bc.khoan_theo_duong ? { khoanTheoDuong: true } : {}),   // D561
    ...(bc.mu_tin ? { muTin: true } : {}),   // D532 — MÙ TIN chặn mua tin sớm
    ...(bc.tin ? { tinMan: { tin: bc.tin, hinh: bc.hinh, seed: bc.seed, ...(bc.lon ? { lon: bc.lon } : {}) } } : {}),   // D532 — nhãn hành vi tin
  };
}

/**
 * D499 — đường giá NGƯỜI CHƠI THẤY (dòng nhịp): đường của màn + cú TỰ ĐẨY của chính các lệnh đã ghi (`apXungBan`). Khớp lệnh tự đọc giá qua cùng
 * công thức (`lechBan`) trên đường GỐC — đừng đưa đường này vào `ketQuaMan` (đẩy hai lần).
 */
export function dungDongManNhin(bc: BoiCanhMan, lenh: readonly LenhMan[]) {
  const du0 = dungDongManDu(bc, lenh);
  if (!bc.tu_day) return { ...du0, xungBan: [] as XungBan[], xungKhoan: {} as Record<string, XungBan[]> };
  const khop = (min: ReturnType<typeof dungDongMan>) =>
    ketQuaMan({ min, ...thamSoKhop(bc), kienNhan: bc.kien_nhan === true, nongVoi: bc.nong_voi === true, la: laCuaMan(bc.loi_cam ?? [], lenh, bc.loi_man), lenh });
  const kq0 = khop(du0.min);
  // D512 — lượt hai: đám đông xét ngưỡng trên giá ĐÃ cộng cú tự đẩy của người (châm ngòi) — cùng hai lượt với `dungDongManKhop`.
  const du = kq0.xungBan.length && damDongCua(bc).length ? dungDongManDu(bc, lenh, kq0.xungBan) : du0, kq = du === du0 ? kq0 : khop(du.min);
  return { ...du, min: apXungBan(du.min, kq.xungBan), xungBan: kq.xungBan, xungKhoan: kq.db?.xungKhoan ?? {} };
}

/**
 * D512 — ĐƯỜNG KHỚP của người (gốc + đám đông, CHƯA cộng cú tự đẩy — khớp tự cộng qua `lechBan`): hai lượt — lượt một lấy cú tự đẩy của người, lượt hai
 * cho đám đông xét ngưỡng trên giá đã bị đẩy ⇒ lệnh của vai lớn châm ngòi dây chuyền NGAY trong màn. Không đẩy / không đám đông ⇒ một lượt (byte-hệt cũ).
 * Mọi cửa khớp của người (sổ · tạm tính · quyết toán · lệnh) đi qua đây — một nguồn.
 */
export function dungDongManKhop(bc: BoiCanhMan, lenh: readonly LenhMan[]) {
  const min0 = dungDongMan(bc, lenh);
  if (!bc.tu_day || !lenh.length || !damDongCua(bc).length) return min0;
  const kq0 = ketQuaMan({ min: min0, ...thamSoKhop(bc), kienNhan: bc.kien_nhan === true, nongVoi: bc.nong_voi === true, la: laCuaMan(bc.loi_cam ?? [], lenh, bc.loi_man), lenh });
  return kq0.xungBan.length ? dungDongMan(bc, lenh, kq0.xungBan) : min0;
}

/**
 * D507 — tỷ lệ giá BIỂU ĐỒ của một khoản bảng phụ ở nhịp k so với giá cuối màn (khoản đã gồm % cả vòng): giá trị BÁN HẾT = khoản × tỷ lệ. Dựng đường
 * bảng phụ lười (chỉ khi có cú BÁN HẾT). Không có đường ⇒ null (khớp bằng nguyên khoản).
 */
function giaKhoanCua(bc: BoiCanhMan): (ma: string, k: number) => number | null {
  let phu: Record<string, number[]> | null = null;
  return (ma, k) => {
    phu ??= duongPhuCua(bc);
    const g = phu[ma];
    if (!g?.length) return null;
    const cuoi = g[g.length - 1]!;
    return cuoi > 0 ? g[Math.max(0, Math.min(g.length - 1, k + 1))]! / cuoi : null;
  };
}

/** D507 — bảng phụ NGƯỜI CHƠI THẤY: đường bảng phụ + cú bán BÁN HẾT của chính ghế (vai lớn) trên mã đó. */
/**
 * D561 — BẢNG PHỤ của khoá nhiều mã: đường THẬT (người chơi thấy) của các màn khác — màn chính + màn con, trừ mã đang xem — theo nhịp, gốc 100 =
 * giá mở màn (cùng khuôn `duongPhuNhin`: 1 + SO_NHIP điểm). Chạm mã nào ở bảng phụ là sang đúng đường ấy (không phải đường tương quan giả lập).
 */
export function duongNhieuNhin(goc: BoiCanhMan, lenh: readonly LenhMan[], maXem: string): Record<string, number[]> {
  const ra: Record<string, number[]> = {};
  for (const bc of [goc, ...(goc.nhieu ?? [])]) {
    if (bc.ma === maXem) continue;
    const min = dungDongManNhin(bc, lenhXemMa(goc, lenh, bc.ma)).min, n0 = NEN_LS * K_MIN, g0 = min[n0 - 1]!.c;
    const g = [100];
    for (const c of min.slice(n0)) for (const t of c.tick) g.push((t * 100) / g0);
    ra[bc.ma] = g.slice(0, SO_NHIP + 1);
  }
  return ra;
}

export function duongPhuNhin(bc: BoiCanhMan, xungKhoan: Readonly<Record<string, readonly XungBan[]>>): Record<string, number[]> {
  const phu = duongPhuCua(bc);
  return Object.fromEntries(Object.entries(phu).map(([ma, g]) => [ma, apXungMang(g, xungKhoan[ma] ?? [])]));
}

/** Áp kết quả màn vào khoản: `vi_the[mã] += lãi lỗ`, sàn 0. Ghế đã cháy / không còn mã đó ⇒ bỏ qua. */
export function apMg(st: TrangThaiTran, mg: MgVong): TrangThaiTran {
  let doi = false;
  const ghe = st.ghe.map((g): Ghe => {
    const x = mg[g.id];
    if (!x || g.da_chay || g.vi_the[x.ma] === undefined || (x.loi === 0 && !x.nap && !x.them?.length)) return g;
    doi = true;
    const vt: Record<string, number> = { ...g.vi_the, [x.ma]: Math.max(0, g.vi_the[x.ma]! + x.loi) };
    for (const t of x.them ?? []) if (vt[t.ma] !== undefined) vt[t.ma] = Math.max(0, vt[t.ma]! + t.loi);   // D561 — màn con
    let von = g.von;
    for (const [ma, lay] of Object.entries(x.nap ?? {})) {
      if (ma === MA_TIEN_MAT) von = Math.max(0, von - lay);   // D507 — nạp / BÁN HẾT Tiền mặt trừ vào tiền mặt
      else if (vt[ma] !== undefined) vt[ma] = Math.max(0, vt[ma]! - lay);
    }
    // D507 — khoản bị BÁN HẾT bán trọn ⇒ 0 chip, kể cả phần giá đã đổi từ lúc mở màn tới lúc áp (thị trường vòng kế).
    for (const ma of x.het ?? []) if (vt[ma] !== undefined) vt[ma] = 0;
    return { ...g, vi_the: vt, von, ...(x.xu ? { xu: (g.xu ?? 0) + x.xu } : {}) };   // D530 — xu nhiệm vụ lõi theo màn
  });
  return doi ? { ...st, ghe } : st;
}

/**
 * Kết quả màn vòng `vong` của CẢ BÀN trên trạng thái đầu vòng `vong + 1` (chưa áp). Người: cú bấm + bối cảnh đã ghi lúc mở màn (vắng ⇒ dựng lại
 * cùng hàm — chưa mở màn thì không bấm ⇒ tự động). Bot: chỉ ghế cầm Bắt Đáy chơi (lõi khác chưa có trong màn), lệnh theo `lenhBotBatDay`.
 */
export function tinhMgCaBan(st: TrangThaiTran, p: {
  seedTran: number; vong: number; ban?: { lenh: readonly LenhMan[]; bc?: BoiCanhMan };
  /** D561 — lõi màn người chơi chọn lúc chốt vòng (khoá v65); dùng cả khi người chưa mở màn (không có `ban.bc`). */
  loiMan?: string;
  /** D479 — % thị trường công khai của vòng `vong` (engine) — bot dựng bối cảnh bằng cùng số người chơi thấy. */
  loiSuat: Readonly<Record<string, number>> | null;
}): { mg: MgVong; ban: KetQuaManGhe | null; /** D561 — kết quả từng màn con của người (khoá `nhieu_ma`). */ nhieu?: KetQuaManGhe[] } {
  const mg: Record<string, MgGhe> = {};
  let ban: KetQuaManGhe | null = null;
  let nhieu: KetQuaManGhe[] | undefined;
  /*
   * D507 (founder 04/10: "Những người chơi đang chơi và cả bot ở bàn tài sản kia (chỉ lệnh lớn của các role)") — cú đẩy của NGƯỜI (tự đẩy mã chính
   * gồm cả cú thanh lý · cú bán BÁN HẾT trên mã khác; chỉ vai lớn mới có) ĐÈ lên đường giá của ghế KHÁC đang chơi màn trên đúng mã đó. Người chạy
   * TRƯỚC để biết cú đẩy; `mg` vẫn ghi theo thứ tự ghế như cũ.
   */
  const day: Record<string, XungBan[]> = {};
  const thuTu = [...st.ghe.filter((g) => g.id === 'ban'), ...st.ghe.filter((g) => g.id !== 'ban')];
  const ra: Record<string, MgGhe> = {};
  for (const g of thuTu) {
    if (g.da_chay) continue;
    const laNguoi = g.id === 'ban';
    const bc0 = laNguoi && p.ban?.bc ? p.ban.bc : laNguoi ? boiCanhNguoi(st, p.seedTran, p.vong, g, p.loiSuat) : boiCanhCuaGhe(st, p.seedTran, p.vong, g, p.loiSuat);
    if ('loi' in bc0) continue;
    const loi = g.danh_muc.chien_thuat as readonly string[];
    const la = laNguoi ? laCuaMan(loi, p.ban?.lenh ?? [], p.loiMan ?? bc0.loi_man) : loi.includes('bat_day') ? 'bat_day' : null;
    // D528 — bot không cầm Bắt Đáy vẫn chịu TÂM LÝ YẾU / trần thua Tổ Chức trên khoản giữ suốt (luật chạy cả khi không bấm gì).
    if (!laNguoi && !la && !bc0.tam_ly_yeu && !bc0.tran_thua_giu) continue;
    // D483 — người: đường giá dựng CÙNG cú bấm (cú gài tin đổi đường). Bot không gài: đường gốc, lệnh đọc từ chính đường ấy.
    // D512 — người: đường khớp hai lượt (đám đông bị châm ngòi) · bot cùng mã: đám đông của bot cũng xét trên giá đã bị người đẩy, rồi cộng cú đẩy ấy.
    // D561 — lệnh của màn chính (lệnh mang `ma` của màn con đi riêng bên dưới); lá chọn đọc TOÀN BỘ lệnh (một lõi cho cả màn).
    const lenhChinh = laNguoi ? lenhXemMa(bc0, p.ban?.lenh ?? [], bc0.ma) : [];
    const min0 = laNguoi ? dungDongManKhop(bc0, lenhChinh) : dungDongMan(bc0, [], day[bc0.ma]);
    const min = !laNguoi && day[bc0.ma]?.length ? apXungBan(min0, day[bc0.ma]!) : min0;
    const trMan = { kienNhan: bc0.kien_nhan === true, nongVoi: bc0.nong_voi === true };
    const lenh = laNguoi ? lenhChinh : la === 'bat_day' ? lenhBotBatDay(min, cuaSoTrait(trMan), bc0.khoan_theo_duong === true, bc0.ba_phan === true) : [];
    const kq = ketQuaMan({ min, ...thamSoKhop(bc0), ...trMan, la, lenh });
    const them: { ma: string; loi: number }[] = [];
    if (laNguoi) {
      ban = { ...kq, ma: bc0.ma, von: bc0.von, von_sau: bc0.von_sau ?? bc0.von };
      if (kq.xungBan.length) day[bc0.ma] = [...kq.xungBan];
      for (const [ma, xs] of Object.entries(kq.db?.xungKhoan ?? {})) day[ma] = [...(day[ma] ?? []), ...xs];
      // D561 — màn con: cùng lõi, cùng cửa sổ trait, lệnh riêng; cú bán của người đè lên màn bot cùng mã như màn chính (D507).
      if (bc0.nhieu?.length) {
        nhieu = [];
        for (const sub of bc0.nhieu) {
          const lx = lenhXemMa(bc0, p.ban?.lenh ?? [], sub.ma);
          const kx = ketQuaMan({ min: dungDongManKhop(sub, lx), ...thamSoKhop(sub), ...trMan, la, lenh: lx });
          nhieu.push({ ...kx, ma: sub.ma, von: sub.von, von_sau: sub.von_sau ?? sub.von });
          if (kx.xungBan.length) day[sub.ma] = [...(day[sub.ma] ?? []), ...kx.xungBan];
          if (kx.loi !== 0) them.push({ ma: sub.ma, loi: kx.loi });
        }
      }
    }
    const nap: Record<string, number> = {};
    for (const n of kq.db?.nap ?? []) nap[n.ma] = (nap[n.ma] ?? 0) + n.lay;
    const het = [...new Set((kq.db?.nap ?? []).filter((n) => n.luc === 'ban_het' && n.ma !== MA_TIEN_MAT).map((n) => n.ma))];
    // D530 — xu nhiệm vụ lõi: lõi đang chơi làm hơn giữ suốt (Tâm lý yếu / trần thua trên khoản giữ không phải lõi ⇒ `la` null ⇒ không tính).
    const xu = st.loi_chi_trong_man === true && st.nhiem_vu_loi === true && la !== null && kq.loi > 0 ? LUA.XU_NHIEM_VU_LOI : 0;
    if (kq.loi !== 0 || Object.keys(nap).length || them.length) ra[g.id] = { ma: bc0.ma, loi: kq.loi, ...(Object.keys(nap).length ? { nap } : {}), ...(het.length ? { het } : {}), ...(xu ? { xu } : {}), ...(them.length ? { them } : {}) };
  }
  for (const g of st.ghe) if (ra[g.id]) mg[g.id] = ra[g.id]!;
  return { mg, ban, ...(nhieu ? { nhieu } : {}) };
}
