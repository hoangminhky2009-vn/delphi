/**
 * BỘ LUẬT GỠ — bài canh cho luật gỡ khoá `balance_version` (founder 03/09/2026,
 * câu hỏi B2 phương án (b), toàn văn `docs/nhat-ky/D217.md`): một khoá CHỈ được
 * gỡ khỏi `BO_LUAT_THEO_PHIEN_BAN` trong lúc còn FOUNDER-ONLY; đã ra người
 * ngoài thì đóng băng vĩnh viễn. Xem docstring đầy đủ ở `config/holdem_balance.ts`
 * ngay trên `BO_LUAT_THEO_PHIEN_BAN` và trên `SO_KHOA_DA_GO`.
 *
 * ⚠ VÌ SAO CẦN BÀI NÀY: `SO_KHOA_DA_GO` là một sổ CHÉP TAY — không có gì ép nó
 * đúng ngoài mắt người viết. Không canh thì nó có thể tự mâu thuẫn (một khoá
 * "đã gỡ" mà vẫn còn sống trong bảng chính) hoặc rỗng nghĩa (lý do/con trỏ để
 * trống) mà không ai biết — đúng lớp lỗi đã cắn repo này nhiều lần (D169/D216).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, luatCua, SO_KHOA_DA_GO,
} from '../config/holdem_balance.js';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';

/** Bộ cờ TẮT HẾT — bản chép độc lập của fallback trong `luatCua()`, CỐ Ý không
 *  import lại từ đó: bài này canh RA output đúng-hình-dạng, tự nó không được
 *  phép mượn cùng một hằng số với thứ nó đang kiểm (D61). */
const TAT_HET = {
  nav: false, cuocTat: false, botTuQuyetCamKet: false, luatVon: false, dacQuyen: false,
  donBayCamKet: false, daDangHoaTranTaiSan: false, kyQuyRong: false,
  tuongQuan: false, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false,
  chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false,
  xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false,
  coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false,
  phiVoiVang: false, botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false,
  gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false,
  tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false,
  giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false,
  lichKhongDoi: false, lopVn: false,
  taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false,
  khoaTaiSanTat: false, tietKiem: false,
  betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false,
  donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false,
  khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false,
  phiLenhNhe: false,
  phiLenhBac: false,
  // v52 (D371) — bộ số Đa Dạng Hoá mới. Khoá lạ/thiếu ⇒ TẮT ⇒ đọc bộ số CŨ, đúng
  // nếp "không đoán bừa": trận mang khoá không tra được phải replay bằng luật cũ nhất.
  daDangV52: false,
  // v53 (D373) — úp ô đang chơi. TẮT ở fallback là đúng nếp trên: khoá lạ ⇒ chơi luật CŨ,
  // tức ô vẫn ngửa. Bật nhầm ở đây là trận cũ replay ra một bàn khác hẳn bàn nó từng có.
  oUp: false,
  // D386 — bot đọc nền regime ở vòng tin (chưa phiên bản nào bật). TẮT ⇒ bối cảnh lệnh không có
  // `nen`, tức đúng hành vi v36–v52 mà mọi trận đã lưu đang mang.
  botDocNen: false,
  // v54 (D389) — bánh xe mùa + bốn cờ lược bỏ. TẮT ⇒ luật cũ: máy tick, khẩu vị chọn được,
  // vốn theo vai, chọn cỡ bàn, đủ 11 lõi.
  banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false,
  muaDinhHan: false, tinTheoMua: false, luatLa: false,
  // v54 (D403) — ba cờ quỹ vòng. TẮT ⇒ luật cũ: có nút BỎ, nền phẳng 500, không trần phần một ghế.
  boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false,
  // v54 (D405) — sổ chịu nền kinh tế. TẮT ⇒ luật cũ: sổ miễn lạm phát, lãi chốt lúc mở, không đổ vỡ.
  tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false,
  // v55 (D409) — lửa · xu · trait · Lướt Sóng mới. TẮT ⇒ luật cũ: không lửa, không chợ trait, Lướt Sóng bảng rẻ.
 lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
};

describe('SO_KHOA_DA_GO — sổ gỡ tự nhất quán', () => {
  it('mọi khoá trong sổ gỡ đều VẮNG MẶT khỏi BO_LUAT_THEO_PHIEN_BAN (sổ không nói dối)', () => {
    const conSong = SO_KHOA_DA_GO.filter((k) => k.khoa in BO_LUAT_THEO_PHIEN_BAN);
    expect(conSong.map((k) => k.khoa), 'khoá "đã gỡ" nhưng vẫn còn sống trong registry').toEqual([]);
  });

  it('không khoá nào xuất hiện hai lần trong CHÍNH sổ gỡ', () => {
    const khoa = SO_KHOA_DA_GO.map((k) => k.khoa);
    expect(khoa.length, `trùng khoá trong SO_KHOA_DA_GO: ${khoa.join(', ')}`).toBe(new Set(khoa).size);
  });

  it('không khoá nào vừa SỐNG (BO_LUAT_THEO_PHIEN_BAN) vừa GỠ (SO_KHOA_DA_GO) — '
    + 'hai sổ không được đè lên nhau', () => {
    const song = new Set(Object.keys(BO_LUAT_THEO_PHIEN_BAN));
    const trung = SO_KHOA_DA_GO.map((k) => k.khoa).filter((k) => song.has(k));
    expect(trung, 'khoá xuất hiện ở CẢ HAI sổ — mâu thuẫn không thể cả hai đều đúng').toEqual([]);
  });

  it('sổ gỡ không rỗng, và MỌI mục có lý do founder-only + con trỏ D-entry không rỗng', () => {
    // Sổ rỗng thì "không ai biết vì sao gỡ được" quay lại y hệt trước khi có sổ.
    expect(SO_KHOA_DA_GO.length).toBeGreaterThan(0);
    const thieu: string[] = [];
    for (const k of SO_KHOA_DA_GO) {
      if (!k.khoa.trim()) thieu.push('(một mục) thiếu `khoa`');
      if (!k.ngay_go.trim()) thieu.push(`${k.khoa}: thiếu ngay_go`);
      // Lý do rỗng là ĐÚNG sự mơ hồ mà cả sổ này dựng ra để xoá — không được lọt.
      if (!k.ly_do_founder_only.trim()) thieu.push(`${k.khoa}: thiếu ly_do_founder_only`);
      if (!k.d_tro.trim()) thieu.push(`${k.khoa}: thiếu d_tro (con trỏ D-entry)`);
      if (!Number.isFinite(k.so_tran_do_duoc) || k.so_tran_do_duoc < 0) {
        thieu.push(`${k.khoa}: so_tran_do_duoc không hợp lệ (${k.so_tran_do_duoc})`);
      }
    }
    expect(thieu, 'mục sổ gỡ thiếu trường bắt buộc').toEqual([]);
  });

  it('ba khoá tiền lệ khớp đúng số trận config/giai_doan.ts + D192 đã đo (81 · 7 · 7)', () => {
    const theoKhoa = Object.fromEntries(SO_KHOA_DA_GO.map((k) => [k.khoa, k]));
    expect(theoKhoa['balance-v2-D20lever']?.so_tran_do_duoc).toBe(81);
    expect(theoKhoa['balance-v3-D1']?.so_tran_do_duoc).toBe(7);
    expect(theoKhoa['balance-v4-D2D3D4']?.so_tran_do_duoc).toBe(7);
  });
});

describe('registry sống vẫn còn khoá mặc định', () => {
  it('HOLDEM_BALANCE_VERSION (mặc định đang chạy) vẫn nằm trong BO_LUAT_THEO_PHIEN_BAN — '
    + 'xoá khoá đang sống mà không đổi hằng số kia là một việc KHÔNG được lặng lẽ lọt qua', () => {
    expect(HOLDEM_BALANCE_VERSION in BO_LUAT_THEO_PHIEN_BAN).toBe(true);
  });
});

describe('luatCua() — hành vi trả về KHÔNG đổi, nhưng giờ có cảnh báo (M3, D217)', () => {
  it('khoá ĐÃ GỠ (balance-v4-D2D3D4) ⇒ bộ cờ TẮT HẾT y hệt trước, và console.warn '
    + 'ĐÚNG MỘT LẦN dù gọi hai lần', () => {
    // ⚠ CỐ Ý không dùng balance-v2-D20lever ở bài này: giai_doan.test.ts (chạy
    // cùng tiến trình khi hai bài canh cùng lúc) đã tự gọi luatCua() trên đúng
    // khoá đó qua server/admin_thongke.ts, nên "gọi hai lần, mong đúng một
    // cảnh báo" sẽ ăn trạng thái "đã cảnh báo" của MỘT BÀI KHÁC — không phải
    // lỗi của canhBaoKhoaLa. balance-v4-D2D3D4 không bị bài nào khác chạm.
    const im = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r1 = luatCua('balance-v4-D2D3D4');
    const r2 = luatCua('balance-v4-D2D3D4');
    // ⚠ ĐỌC lịch sử gọi TRƯỚC khi mockRestore() — mockRestore() cũng dọn sạch
    // .mock.calls (tương đương mockReset()), đọc sau là luôn thấy 0.
    expect(im).toHaveBeenCalledTimes(1);
    expect(String(im.mock.calls[0]?.[0])).toContain('balance-v4-D2D3D4');
    im.mockRestore();
    expect(r1).toEqual(TAT_HET);
    expect(r2).toEqual(TAT_HET);
  });

  it('khoá CHƯA TỪNG NGHE (không ở registry, không ở sổ gỡ) ⇒ bộ cờ TẮT HẾT y hệt '
    + 'trước, và console.warn ĐÚNG MỘT LẦN dù gọi hai lần', () => {
    const KHOA_LA = '__test_khoa_chua_tung_nghe_D217__';
    const im = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r1 = luatCua(KHOA_LA);
    const r2 = luatCua(KHOA_LA);
    expect(im).toHaveBeenCalledTimes(1);
    expect(String(im.mock.calls[0]?.[0])).toContain(KHOA_LA);
    im.mockRestore();
    expect(r1).toEqual(TAT_HET);
    expect(r2).toEqual(TAT_HET);
  });

  it('hai cảnh báo KHÁC CHỮ NHAU — khoá đã gỡ ("đúng dự kiến") khác khoá chưa từng '
    + 'nghe ("có thể bị xoá NHẦM") — người đọc log phải phân biệt được không cần mở code', () => {
    const imGo = vi.spyOn(console, 'warn').mockImplementation(() => {});
    luatCua('balance-v3-D1');
    const chuGo = String(imGo.mock.calls[0]?.[0]);
    imGo.mockRestore();

    const imLa = vi.spyOn(console, 'warn').mockImplementation(() => {});
    luatCua('__test_khoa_chua_tung_nghe_2_D217__');
    const chuLa = String(imLa.mock.calls[0]?.[0]);
    imLa.mockRestore();

    expect(chuGo).not.toBe(chuLa);
    expect(chuGo.toLowerCase()).toContain('gỡ có chủ đích');
    expect(chuLa.toLowerCase()).toContain('nhầm');
  });

  it('khoá SỐNG ⇒ không cảnh báo gì cả — không phải mọi lời gọi luatCua() đều ồn', () => {
    const im = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = luatCua(HOLDEM_BALANCE_VERSION);
    im.mockRestore();
    expect(r).toEqual(BO_LUAT_THEO_PHIEN_BAN[HOLDEM_BALANCE_VERSION]);
    expect(im).not.toHaveBeenCalled();
  });

  it('null/undefined/rỗng ⇒ bộ cờ TẮT HẾT, KHÔNG cảnh báo — "chưa có phiên bản" là '
    + 'một trạng thái đã biết (giaiDoanCuaPhienBan), khác hẳn "khoá lạ"', () => {
    const im = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rNull = luatCua(null);
    const rUndef = luatCua(undefined);
    const rRong = luatCua('');
    im.mockRestore();
    expect(rNull).toEqual(TAT_HET);
    expect(rUndef).toEqual(TAT_HET);
    expect(rRong).toEqual(TAT_HET);
    expect(im).not.toHaveBeenCalled();
  });
});
