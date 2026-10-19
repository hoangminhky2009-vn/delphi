/**
 * BẢNG ĐIỆN TỬ — hàm thuần dựng dữ liệu bảng + phí mở bảng.
 *
 * Bốn nhóm bất biến, theo đúng thứ tự quan trọng:
 *   1. TẤT ĐỊNH — mất cái này là mất replay (kể cả phần nhấp nháy).
 *   2. KHÔNG RÒ THÔNG TIN ẨN — bảng có thu phí, nên nếu nó bán cờ tin giả thì
 *      cả lớp kỹ năng hiệu chỉnh tin (gate 17.6/G4) chết mà không ai thấy.
 *      Cách đo: dựng HAI map khác nhau ĐÚNG một bit `la_tin_gia`, bảng phải
 *      giống hệt khi bit đó chưa tới lúc lộ, và phải KHÁC khi đã lộ.
 *   3. ĐỘ TRỄ + SƯƠNG MÙ đúng luật.
 *   4. PHÍ CÓ THẬT CHẠY — bẫy số 1 của repo là cơ chế trang trí: code có, test
 *      có, mà không đường nào gọi. Nên test phí ĐO Vốn trước/sau, không chỉ
 *      khẳng định hàm trả đúng số.
 */
import { describe, expect, it } from 'vitest';
import {
  apPhiMoBang, coDuMoBang, daLoTinGia, dungBangDienTu, phiMoBang, soLanMoBang,
} from '../server/holdem/bang_dien_tu.js';
import {
  giaiQuyetVong, taoTran, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import type { HoldemMap, OThiTruong } from '../server/holdem/map.js';
import { HOLDEM_MATCH, BANG_DIEN_TU, NHA_CAI, TAI_SAN } from '../config/holdem.js';

function ghe(id: string, taiSan: string[]): GheMoi {
  return {
    id, loai: id === 'ban' ? 'nguoi' : 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: taiSan, chien_thuat: [] },
  };
}

const gd = (id: string): OThiTruong =>
  ({ kind: 'giai_doan', giai_doan: id as never });

const sk = (id: string, laTinGia = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id as never, la_tin_gia: laTinGia,
  boi_canh: 'don_doc', bao_truoc: 'giam',
});

/** Trận với map GHÉP TAY — cần để đặt sự kiện vào đúng vòng muốn thử. */
function tranVoiMap(seed: number, o: OThiTruong[], vong: number): TrangThaiTran {
  const st = taoTran(seed, [ghe('ban', ['btc', 'vn30']), ghe('b2', ['usd'])]);
  const map: HoldemMap = { seed, o };
  return { ...st, map, vong };
}

describe('1. TẤT ĐỊNH', () => {
  it('cùng (seed, vòng, danh mục) → bảng giống hệt, kể cả biên nhấp nháy', () => {
    const mk = () => tranVoiMap(4242, [gd('tang'), sk('chien_tranh'), gd('giam'), gd('di_ngang')], 3);
    expect(dungBangDienTu(mk())).toEqual(dungBangDienTu(mk()));
  });

  it('seed khác → biên nhấp nháy khác (không phải hằng số trá hình)', () => {
    const o = () => [gd('tang'), sk('chien_tranh'), gd('giam'), gd('di_ngang')];
    // Quét nhiều seed: một cặp seed trùng biên là chuyện thường, cả dải trùng
    // mới là dấu hiệu rng không hề được dùng.
    const bien = new Set<string>();
    for (let s = 1; s <= 40; s += 1) {
      const b = dungBangDienTu(tranVoiMap(s, o(), 3));
      bien.add(JSON.stringify(b.thanh_khoan.filter((t) => t.suong_mu).map((t) => t.bien)));
    }
    expect(bien.size).toBeGreaterThan(1);
  });
});

describe('2. KHÔNG RÒ CỜ TIN GIẢ (bảng có thu phí — rò là bán mất kỹ năng)', () => {
  /** Cùng một map, chỉ đổi cờ tin giả của ô vòng `vongDoi`. */
  const capMap = (vongDoi: number) => {
    const dung = (gia: boolean): OThiTruong[] => [
      gd('tang'),
      vongDoi === 2 ? sk('thien_nga_den', gia) : sk('thien_nga_den', false),
      vongDoi === 3 ? sk('chien_tranh', gia) : gd('giam'),
      vongDoi === 4 ? sk('chien_tranh', gia) : gd('di_ngang'),
      gd('di_ngang'),
    ];
    return [dung(false), dung(true)] as const;
  };

  it('ô ĐANG LẬT là tin giả hay thật → bảng KHÔNG khác một byte', () => {
    const [a, b] = capMap(4);
    expect(dungBangDienTu(tranVoiMap(9, a, 4)))
      .toEqual(dungBangDienTu(tranVoiMap(9, b, 4)));
  });

  it('ô VÒNG LIỀN TRƯỚC chưa tới lúc lộ → bảng vẫn KHÔNG khác', () => {
    const [a, b] = capMap(3);
    expect(dungBangDienTu(tranVoiMap(9, a, 4)))
      .toEqual(dungBangDienTu(tranVoiMap(9, b, 4)));
  });

  it('ô ĐÃ LỘ (vòng ≤ V−2) thì bảng PHẢI khác — không thì bảng vô dụng', () => {
    const [a, b] = capMap(2);
    const ba = dungBangDienTu(tranVoiMap(9, a, 4));
    const bb = dungBangDienTu(tranVoiMap(9, b, 4));
    expect(ba.so_cai).not.toEqual(bb.so_cai);
    const doA = ba.so_cai.find((d) => d.vong === 2)!;
    const doB = bb.so_cai.find((d) => d.vong === 2)!;
    expect(doA.dao).toBe(false);
    expect(doB.dao).toBe(true);
    // Tin giả đảo dấu → lực ròng của dòng đó lật chiều.
    expect(doB.luc_bp).toBe(-doA.luc_bp!);
  });

  it('mốc `daLoTinGia` khớp nhịp lộ THẬT của chotPhien (chống trôi định nghĩa)', () => {
    // Chạy thật qua engine, ghi lại vòng nào `tin_gia_lo` nổ cho ô nào.
    const o: OThiTruong[] = [gd('tang'), sk('hack_san', true), gd('giam'), gd('di_ngang'),
      gd('di_ngang'), gd('di_ngang')];
    let st = tranVoiMap(31, o, 1);
    for (let v = 1; v <= 4; v += 1) {
      const r = giaiQuyetVong(st, () => ({ loai: 'theo' as const }));
      const lo = r.ketQua.tin_gia_lo;
      // Kết vòng v ⇒ trạng thái công bố là đầu vòng v+1.
      expect(lo !== null && lo.vong === 2).toBe(daLoTinGia(2, v + 1) && v + 1 === 4);
      st = r.trangThai;
    }
  });
});

describe('3. ĐỘ TRỄ + SƯƠNG MÙ', () => {
  const o = [gd('tang'), sk('chien_tranh'), gd('giam'), sk('ha_lai_suat'), gd('di_ngang')];

  it('LUẬT 1 — sự kiện vòng HIỆN TẠI hiện "?" và không vào tổng ròng', () => {
    const b = dungBangDienTu(tranVoiMap(7, [...o], 4));
    const dongNay = b.so_cai.find((d) => d.vong === 4)!;
    expect(dongNay.an).toBe(true);
    expect(dongNay.do_lon_bp).toBeNull();
    expect(dongNay.con_vong).toBeNull();
    expect(dongNay.dao).toBeNull();
    expect(dongNay.luc_bp).toBeNull();
    // Tên sự kiện KHÔNG bị che: ô đã lật, người chơi thấy rồi.
    expect(dongNay.su_kien).toBe('ha_lai_suat');
  });

  it('tổng ròng = cộng đúng các dòng ĐÃ BIẾT, và đếm đúng dòng chưa rõ', () => {
    const b = dungBangDienTu(tranVoiMap(7, [...o], 4));
    const biet = b.so_cai.filter((d) => d.luc_bp !== null);
    expect(b.tong_rong_bp).toBe(biet.reduce((s, d) => s + d.luc_bp!, 0));
    expect(b.so_dong_chua_ro).toBe(b.so_cai.length - biet.length);
    expect(b.so_dong_chua_ro).toBeGreaterThan(0);   // ô vòng 4 đang bị che
  });

  it('dòng vòng LIỀN TRƯỚC: hiện ĐỘ LỚN, không hiện CHIỀU (chưa lộ tin giả)', () => {
    // Đây là chỗ hai luật giao nhau và dễ cài sai nhất: LUẬT 1 nói dòng này ĐƯỢC
    // hiện (nó thuộc "hết vòng liền trước"), còn nhịp lộ tin giả nói chiều của nó
    // CHƯA được bán. Nên nó không phải dòng "?" mà là dòng nửa sáng.
    const b = dungBangDienTu(tranVoiMap(7,
      [gd('tang'), sk('chien_tranh'), sk('ha_lai_suat'), sk('lam_phat'), gd('di_ngang')], 4));
    const truoc = b.so_cai.find((d) => d.vong === 3)!;
    expect(truoc.an).toBe(false);
    expect(truoc.do_lon_bp).not.toBeNull();
    expect(truoc.con_vong).not.toBeNull();
    expect(truoc.dao).toBeNull();
    expect(truoc.luc_bp).toBeNull();
  });

  it('không dòng ĐÃ BIẾT nào rơi vào cửa sổ độ trễ (đọc theo hằng số config)', () => {
    const b = dungBangDienTu(tranVoiMap(7,
      [gd('tang'), sk('chien_tranh'), sk('ha_lai_suat'), sk('lam_phat'), gd('di_ngang')], 4));
    const cheTu = b.vong - BANG_DIEN_TU.DO_TRE_VONG + 1;
    for (const d of b.so_cai) {
      if (d.vong >= cheTu) expect(d.an).toBe(true);
      else expect(d.an).toBe(false);
    }
  });

  it('vòng 1 chưa có dư âm nào (không có ô nào lật trước đó)', () => {
    const b = dungBangDienTu(tranVoiMap(7, [...o], 1));
    expect(b.so_cai).toEqual([]);
    expect(b.tong_rong_bp).toBe(0);
    expect(b.so_dong_chua_ro).toBe(0);
  });

  it('`con_vong` đếm số vòng còn hiệu lực SAU vòng này, suy từ SO_VONG_ECHO', () => {
    const b = dungBangDienTu(tranVoiMap(7, [...o], 3));   // chiến tranh nổ vòng 2
    const d = b.so_cai.find((x) => x.vong === 2)!;
    expect(d.con_vong).toBe(NHA_CAI.SO_VONG_ECHO - 1 - (3 - 2));
  });

  it('LUẬT 2 — CHỈ btc/cp_cn bị sương mù, ba mã còn lại hiện nấc chính xác', () => {
    const b = dungBangDienTu(tranVoiMap(7, [...o], 3));
    expect(b.thanh_khoan).toHaveLength(TAI_SAN.length);
    for (const t of b.thanh_khoan) {
      const phaiMu = BANG_DIEN_TU.MA_SUONG_MU.includes(t.tai_san_id);
      expect(t.suong_mu).toBe(phaiMu);
      if (phaiMu) {
        expect(t.nac).toBeNull();
        expect(t.vach).toBeNull();
        expect(t.do_sau).toBeNull();
        expect(t.bien).toBeDefined();
        expect(t.bien_vach).toBeDefined();
      } else {
        expect(t.nac).not.toBeNull();
        expect(t.vach).toBeGreaterThanOrEqual(1);
        expect(t.do_sau).toBeGreaterThan(0);
        expect(t.bien).toBeUndefined();
      }
    }
  });

  it('nấc thật ĐƯỢC PHÉP nằm ngoài biên nhấp nháy (biên là gợi ý, không bảo đảm)', () => {
    // Quét seed: nếu KHÔNG seed nào cho biên lệch khỏi nấc đang tính thì nhánh
    // lệch là code chết và luật 2 chỉ còn là chú thích.
    let coLech = false;
    for (let s = 1; s <= 60 && !coLech; s += 1) {
      const b = dungBangDienTu(tranVoiMap(s, [...o], 3));
      const btc = b.thanh_khoan.find((t) => t.tai_san_id === 'btc')!;
      // Nấc nền của btc là 'mong'; giai đoạn 'giam' không co giãn gì.
      if (btc.bien && !btc.bien.includes('mong')) coLech = true;
    }
    expect(coLech).toBe(true);
  });

  it('bảng thú nhận khi đang GIẢ ĐỊNH tin đang nổ là thật', () => {
    const coTin = dungBangDienTu(tranVoiMap(7, [gd('tang'), sk('thien_nga_den')], 2));
    expect(coTin.gia_dinh_tin_that).toBe(true);
    const khong = dungBangDienTu(tranVoiMap(7, [gd('tang'), gd('bien_dong')], 2));
    expect(khong.gia_dinh_tin_that).toBe(false);
    // Sự kiện KHÔNG co giãn thanh khoản thì không phải giả định gì.
    const trungTinh = dungBangDienTu(tranVoiMap(7, [gd('tang'), sk('ha_lai_suat')], 2));
    expect(trungTinh.gia_dinh_tin_that).toBe(false);
  });
});

describe('4. PHÍ MỞ BẢNG — LUẬT 3', () => {
  /*
   * ⚠ KHÔNG chép lại con số phí ở đây. Bản đầu ghim `toBe(25)` và test đó không
   * kiểm gì cả — nó chỉ khoá không cho đổi giá, rồi vỡ ngay lần chỉnh đầu tiên
   * (27/07: 25 → 100). Cái ĐÁNG khoá là phí phải nằm trong khoảng còn tạo được
   * giằng co, chứ không phải đúng một con số:
   *   quá rẻ  → ai cũng mở mọi vòng, cơ chế thành trang trí
   *   quá đắt → không ai dám mở, cũng vô dụng y hệt
   * Ngưỡng đọc theo CAM KẾT NỀN một vòng (500), vì đó mới là thứ người chơi
   * thật sự đem ra so lúc quyết định.
   */
  it('phí nằm trong khoảng còn tạo được giằng co (5%–30% cam kết nền)', () => {
    const tyLe = BANG_DIEN_TU.PHI_MO / HOLDEM_MATCH.CAM_KET_NEN;
    expect(tyLe, `phí ${BANG_DIEN_TU.PHI_MO} = ${(tyLe * 100).toFixed(0)}% cam kết nền`)
      .toBeGreaterThanOrEqual(0.05);
    expect(tyLe).toBeLessThanOrEqual(0.30);
    expect(BANG_DIEN_TU.TOI_DA_MOI_VONG).toBe(1);
    expect(BANG_DIEN_TU.DO_TRE_VONG).toBe(1);
  });

  it('TRỪ THẬT vào Vốn của ghế, đúng số, chỉ ghế đó', () => {
    const st = tranVoiMap(5, [gd('tang'), gd('giam')], 1);
    const truoc = st.ghe.map((g) => g.von);
    const sau = apPhiMoBang(st, 'ban', 1);
    expect(sau.ghe[0]!.von).toBe(truoc[0]! - BANG_DIEN_TU.PHI_MO);
    expect(sau.ghe[1]!.von).toBe(truoc[1]!);   // ghế khác không bị chạm
  });

  it('mở 0 lần → không đổi gì (không thu phí khi chỉ vẽ lại UI)', () => {
    const st = tranVoiMap(5, [gd('tang')], 1);
    expect(apPhiMoBang(st, 'ban', 0)).toBe(st);
  });

  it('trần TOI_DA_MOI_VONG có hiệu lực — mở 5 lần vẫn chỉ thu 1 lần', () => {
    expect(soLanMoBang(5)).toBe(BANG_DIEN_TU.TOI_DA_MOI_VONG);
    const st = tranVoiMap(5, [gd('tang')], 1);
    const sau = apPhiMoBang(st, 'ban', 5);
    expect(st.ghe[0]!.von - sau.ghe[0]!.von)
      .toBe(BANG_DIEN_TU.PHI_MO * BANG_DIEN_TU.TOI_DA_MOI_VONG);
  });

  it('rác trong log → 0 lần, không NaN (log là nguồn dựng lại trận)', () => {
    for (const x of [undefined, null, 'nhiều', {}, NaN, -3, 1.7]) {
      expect(soLanMoBang(x)).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(soLanMoBang(x))).toBe(true);
    }
    expect(soLanMoBang(1.7)).toBe(1);
    expect(soLanMoBang(-3)).toBe(0);
  });

  it('Vốn KHÔNG BAO GIỜ xuống âm, kể cả khi không đủ phí', () => {
    expect(phiMoBang(10, 1)).toBe(10);
    expect(phiMoBang(0, 1)).toBe(0);
    const st = tranVoiMap(5, [gd('tang')], 1);
    const ngheo: TrangThaiTran = {
      ...st, ghe: st.ghe.map((g) => (g.id === 'ban' ? { ...g, von: 7 } : g)),
    };
    expect(apPhiMoBang(ngheo, 'ban', 1).ghe[0]!.von).toBe(0);
  });

  it('ghế đã cháy thì không thu phí (không có bảng để mở)', () => {
    const st = tranVoiMap(5, [gd('tang')], 1);
    const chay: TrangThaiTran = {
      ...st, ghe: st.ghe.map((g) => (g.id === 'ban' ? { ...g, da_chay: true } : g)),
    };
    expect(apPhiMoBang(chay, 'ban', 1).ghe[0]!.von).toBe(st.ghe[0]!.von);
  });

  it('`coDuMoBang` là cổng chặn sớm, khớp đúng ngưỡng phí', () => {
    expect(coDuMoBang(BANG_DIEN_TU.PHI_MO)).toBe(true);
    expect(coDuMoBang(BANG_DIEN_TU.PHI_MO - 1)).toBe(false);
  });

  it('dựng bảng KHÔNG tự trừ phí (nếu không, mỗi lần vẽ lại là mất Vốn)', () => {
    const st = tranVoiMap(5, [gd('tang'), gd('giam')], 2);
    const truoc = st.ghe.map((g) => g.von);
    dungBangDienTu(st);
    expect(st.ghe.map((g) => g.von)).toEqual(truoc);
  });
});
