/**
 * XEM TRƯỚC LỆNH — bài test khoá đúng thứ dễ hỏng nhất của tính năng này:
 * con số hiện trên màn phải là con số server sẽ tính, không phải một con số
 * "trông hợp lý".
 *
 * Vì sao không test bằng cách so với một bản cài đặt thứ hai: so hai bản cài
 * đặt của cùng công thức là phép tự soi gương. Nên khoá bằng (a) BẤT BIẾN hệ
 * kín — thứ đúng bất kể tham số kinh tế đổi, và (b) một vector tính TAY.
 */
import { describe, expect, it } from 'vitest';
import { NAV_V10 } from '@config/holdem';
import { lyDoTuChoi, xemTruocLenh } from '@/lib/xemTruocLenh';

const THO = NAV_V10.BUOC_MOC_THO_BP;

describe('xemTruocLenh', () => {
  it('chuỗi rỗng ⇒ null (không có gì để hiện)', () => {
    expect(xemTruocLenh({ tienMat: 10_000, viThe: {} }, [], THO, false)).toBeNull();
  });

  it('BẤT BIẾN HỆ KÍN: tiền mặt sau + vị thế sau + phí == NAV trước', () => {
    /*
     * Đây là bài đắt nhất trong file. Nó không khoá MỘT con số mà khoá TÍNH
     * CHẤT: xem trước không được phép làm tiền mọc ra hay bốc hơi. Đổi
     * TRUOT_GIA_BP, đổi bước mốc, đổi thanh khoản — bài này vẫn đúng; chỉ có
     * một lỗi cài đặt thật mới làm nó đỏ.
     */
    const truoc = 10_000;
    const xt = xemTruocLenh(
      { tienMat: truoc, viThe: {} },
      [{ ma: 'btc', chieu: 'mua', moc_bp: 2 * THO }],
      THO, false,
    );
    expect(xt).not.toBeNull();
    const tongSau = xt!.tienMatSau
      + Object.values(xt!.viTheSau).reduce((a, b) => a + b, 0)
      + Object.values(xt!.viKhongSau).reduce((a, b) => a + b, 0)
      + xt!.phi;
    expect(tongSau).toBe(truoc);
  });

  it('phí > 0 khi có giao dịch — trượt giá không bao giờ miễn phí', () => {
    const xt = xemTruocLenh(
      { tienMat: 10_000, viThe: {} },
      [{ ma: 'btc', chieu: 'mua', moc_bp: 10_000 }],
      THO, false,
    );
    expect(xt!.phi).toBeGreaterThan(0);
    // ALL-IN ⇒ tiền mặt về 0, toàn bộ nằm ở vị thế + phí.
    expect(xt!.tienMatSau).toBe(0);
  });

  it('BÁN giải ra số ÂM, và bán HẾT thì xoá ô vị thế', () => {
    const xt = xemTruocLenh(
      { tienMat: 0, viThe: { btc: 4_000 } },
      [{ ma: 'btc', chieu: 'ban', moc_bp: 10_000 }],
      THO, false,
    );
    expect(xt!.buoc[0]!.tien).toBe(-4_000);
    expect(xt!.viTheSau.btc).toBeUndefined();
    expect(xt!.tienMatSau).toBeGreaterThan(0);
  });

  it('mốc SAI BƯỚC ⇒ null, không tự làm tròn hộ', () => {
    /*
     * Lõi từ chối cả chuỗi khi mốc lệch bước (không có lá Chia Lệnh mà bấm 5%).
     * Xem trước phải IM theo — nếu nó tự làm tròn để có số mà hiện thì màn hình
     * vẽ ra một lệnh server sẽ không bao giờ nhận.
     */
    expect(xemTruocLenh(
      { tienMat: 10_000, viThe: {} },
      [{ ma: 'btc', chieu: 'mua', moc_bp: 500 }],
      THO, false,
    )).toBeNull();
  });

  it('mở KHỐNG khi không có lá Bán Khống ⇒ null', () => {
    expect(xemTruocLenh(
      { tienMat: 10_000, viThe: {} },
      [{ ma: 'btc', chieu: 'khong', moc_bp: 2 * THO }],
      THO, false,
    )).toBeNull();
  });

  it('mã không tồn tại ⇒ null', () => {
    expect(xemTruocLenh(
      { tienMat: 10_000, viThe: {} },
      [{ ma: 'khong_co_ma_nay', chieu: 'mua', moc_bp: 2 * THO }],
      THO, false,
    )).toBeNull();
  });

  it('BÁN TRƯỚC MUA: all-in rồi muốn đảo mã vẫn giải được', () => {
    /*
     * Luật broker-bù-tiền-trong-ngày (01/08). Tiền mặt 0, đang ôm btc; bán btc
     * rồi mua vàng phải ra được chuỗi hai lệnh — nếu xem trước giải theo đúng
     * thứ tự bấm thì lệnh mua ra 0 đồng và màn hình sẽ nói dối là "không mua
     * được".
     */
    const xt = xemTruocLenh(
      { tienMat: 0, viThe: { btc: 6_000 } },
      [
        { ma: 'vang', chieu: 'mua', moc_bp: 10_000 },
        { ma: 'btc', chieu: 'ban', moc_bp: 10_000 },
      ],
      THO, false,
    );
    expect(xt).not.toBeNull();
    expect(xt!.buoc).toHaveLength(2);
    expect(xt!.buoc[0]!.tien).toBeLessThan(0); // bán giải trước
    expect(xt!.viTheSau.vang).toBeGreaterThan(0);
  });

  /*
   * v29 — PHÍ VỘI VÀNG. Cờ đi từ server (`ban.phi_voi_vang`) xuyên xuống chính
   * lõi tính: màn phải báo đúng con số server sẽ trừ, cả hai chế độ.
   */
  it('v29: cờ vội vàng bật ⇒ phí CAO HƠN cùng chuỗi, và hệ kín vẫn cân', () => {
    const ghe = { tienMat: 10_000, viThe: {} };
    const lenh = [{ ma: 'btc', chieu: 'mua' as const, moc_bp: 10_000 }];
    const tat = xemTruocLenh(ghe, lenh, THO, false, false)!;
    const bat = xemTruocLenh(ghe, lenh, THO, false, true)!;
    expect(bat.phi, 'bật cờ mà phí y cũ = xem trước nói dối về v29')
      .toBeGreaterThan(tat.phi);
    // BẤT BIẾN HỆ KÍN (D67): tiền sau + vị thế sau + phí == NAV trước.
    const tong = bat.tienMatSau
      + Object.values(bat.viTheSau).reduce((a, b) => a + b, 0) + bat.phi;
    expect(tong).toBe(10_000);
  });

  it('v34 — hệ số tác động giá theo VAI đi vào phí xem trước: ×1,5 ⇒ phí = floor(phí gốc × 1,5), ×0,5 ⇒ nửa', () => {
    /*
     * C4 / D67 "báo 140 trừ 190": server trừ trượt giá × hệ số vai, nên màn PHẢI
     * nhân đúng hệ số đó. Không so với bản cài thứ hai — so chính kết quả của
     * cùng hàm với hệ số 1, vì `tinhTruot` nhân SAU CÙNG và floor MỘT lần.
     */
    const lenh = [{ ma: 'btc', chieu: 'mua' as const, moc_bp: 10000 }];
    const goc = xemTruocLenh({ tienMat: 10_000, viThe: {} }, lenh, THO, false, true)!;
    const doiLai = xemTruocLenh({ tienMat: 10_000, viThe: {} }, lenh, THO, false, true, 1.5)!;
    const caNhan = xemTruocLenh({ tienMat: 10_000, viThe: {} }, lenh, THO, false, true, 0.5)!;
    expect(goc.phi).toBeGreaterThan(0);
    expect(doiLai.phi).toBe(Math.floor(goc.phi * 1.5));
    expect(caNhan.phi).toBe(Math.floor(goc.phi * 0.5));
    // Vắng tham số ⇒ y hệt hệ số 1 (trận cũ / không vai không đổi một chip).
    expect(xemTruocLenh({ tienMat: 10_000, viThe: {} }, lenh, THO, false, true)!.phi).toBe(goc.phi);
  });

  it('v50 (D345) — cờ phí nhẹ đi vào xem trước: phí THẤP hơn bảng cũ, Khớp Nhanh = floor(phí nhẹ × 30%), hệ kín vẫn cân', () => {
    /*
     * Server phát `ban.phi_lenh_nhe` + `phi_lenh_con_bp`; màn thiếu cờ thì báo phí bảng cũ (10–20%)
     * trong khi server trừ bảng mới — đúng ca "báo 140 trừ 190" của D67, chiều ngược lại.
     * Không so với bản cài thứ hai: so chính hàm này với cờ tắt / bật / bật + phần còn.
     */
    const ghe = { tienMat: 10_000, viThe: {} };
    const lenh = [{ ma: 'btc', chieu: 'mua' as const, moc_bp: 10000 }];
    const cu = xemTruocLenh(ghe, lenh, THO, false, true)!;
    const nhe = xemTruocLenh(ghe, lenh, THO, false, true, 1, undefined, false, false, undefined,
      { phiLenhNhe: true })!;
    const kn = xemTruocLenh(ghe, lenh, THO, false, true, 1, undefined, false, false, undefined,
      { phiLenhNhe: true, phiLenhConBp: 3000 })!;
    expect(nhe.phi).toBeGreaterThan(0);
    expect(nhe.phi, 'bật cờ phí nhẹ mà phí không giảm = xem trước nói dối về v50').toBeLessThan(cu.phi);
    expect(kn.phi).toBe(Math.floor(nhe.phi * 3000 / 10000));
    // Phần còn KHÔNG có cờ phí nhẹ ⇒ bị bỏ qua (trận v49 cầm Khớp Nhanh không được giảm lậu).
    expect(xemTruocLenh(ghe, lenh, THO, false, true, 1, undefined, false, false, undefined,
      { phiLenhConBp: 3000 })!.phi).toBe(cu.phi);
    for (const x of [nhe, kn]) {
      const tong = x.tienMatSau + Object.values(x.viTheSau).reduce((a, b) => a + b, 0) + x.phi;
      expect(tong).toBe(10_000);
    }
  });

  it('v51 (D346) — cờ hai bậc: lệnh nhỏ RẺ hơn v50, lệnh dồn hết ĐẮT hơn, và suất bậc 1 không leo', () => {
    /*
     * Cùng lớp lỗi với v50 ở trên, chiều ngược lại: thiếu cờ thì màn báo bảng v50 (25% vốn 1,28%)
     * trong khi server trừ bảng hai bậc (0,28%). Khoá bằng TÍNH CHẤT của hình phí, không ghim số —
     * vector tay nằm ở `tests/phi_lenh_v51.test.ts`, bên này chỉ canh dây nối.
     */
    const ghe = { tienMat: 10_000, viThe: {} };
    const xt = (mocBp: number, bac: boolean) => xemTruocLenh(
      ghe, [{ ma: 'btc', chieu: 'mua', moc_bp: mocBp }], THO, false, true, 1,
      undefined, false, false, undefined,
      bac ? { phiLenhNhe: true, phiLenhBac: true } : { phiLenhNhe: true })!;

    // Lệnh 25% vốn: hai bậc rẻ hơn hẳn v50.
    expect(xt(2500, true).phi, 'bật cờ hai bậc mà lệnh nhỏ không rẻ đi')
      .toBeLessThan(xt(2500, false).phi);
    // ALL-IN: hai bậc ĐẮT hơn v50 — đây là cái phanh.
    expect(xt(10000, true).phi, 'bật cờ hai bậc mà dồn hết không đắt lên')
      .toBeGreaterThan(xt(10000, false).phi);
    // Hình hai bậc: suất phí của lệnh 25% (trong ngưỡng) thấp hơn hẳn suất của ALL-IN.
    const suat = (m: number) => xt(m, true).phi / Math.floor((10_000 * m) / 10000);
    expect(suat(2500) * 5).toBeLessThan(suat(10000));
    // Hệ kín vẫn cân.
    const x = xt(10000, true);
    expect(x.tienMatSau + Object.values(x.viTheSau).reduce((a, b) => a + b, 0) + x.phi).toBe(10_000);
  });

  it('D516 — độ sâu chợ của ghế (`sauBp`, vai vốn to) đi vào xem trước: Cá Mập 200.000 mua 25 % rẻ hẳn đi, hệ kín vẫn cân', () => {
    // Canh DÂY NỐI (server phát `phi_lenh_sau_bp`); vector tay ở `tests/phi_sau_vai_v57.test.ts`. Thiếu dây ⇒ màn báo phí cao hơn phí bị trừ.
    const ghe = { tienMat: 200_000, viThe: {} };
    const xt = (sauBp?: number) => xemTruocLenh(
      ghe, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }], THO, false, true, 1,
      undefined, false, false, undefined,
      { phiLenhNhe: true, phiLenhBac: true, ...(sauBp !== undefined ? { sauBp } : {}) })!;
    expect(xt(44_721).phi, 'thiếu sauBp trong dây nối xem trước').toBeLessThan(xt().phi * 0.7);
    const x = xt(44_721);
    expect(x.tienMatSau + Object.values(x.viTheSau).reduce((a, b) => a + b, 0) + x.phi).toBe(200_000);
  });
});

describe('xemTruocLenh — v55 trait ràng buộc lệnh (D425)', () => {
  // coBanKhong · voiVang · tacDongGia · mandate · khongTheoMa · khongTheoHanMuc · vonQuyChieu · phiLenh — rồi tới `trait`
  const TRONG = [false, false, 1, undefined, false, false, undefined, {}] as const;
  it('SỔ MỎNG: tiền mặt + vị thế + trượt + phí cố định = trước; mỗi lệnh một lần phí; mua không đủ trả phí ⇒ `so_mong`', () => {
    const truoc = 10_000;
    const lenh = [{ ma: 'btc', chieu: 'mua' as const, moc_bp: 2 * THO }, { ma: 'vang', chieu: 'mua' as const, moc_bp: THO }];
    const xt = xemTruocLenh({ tienMat: truoc, viThe: {} }, lenh, THO, ...TRONG, { phiCoDinhLenh: 50 })!;
    expect(xt.phiCoDinh).toBe(100);
    const tong = xt.tienMatSau + Object.values(xt.viTheSau).reduce((a, b) => a + b, 0) + xt.phi + xt.phiCoDinh;
    expect(tong).toBe(truoc);
    const khong = xemTruocLenh({ tienMat: truoc, viThe: {} }, lenh, THO, false)!;
    expect(khong.phiCoDinh).toBe(0);
    expect(xt.tienMatSau).toBe(khong.tienMatSau);
    expect(lyDoTuChoi({ tienMat: 100, viThe: {} }, [{ ma: 'btc', chieu: 'mua', moc_bp: THO }], THO, ...TRONG,
      { phiCoDinhLenh: 50 })).toBe('so_mong');
  });
  it('GÔNG CÙM: bán vượt phần còn được ⇒ `gong_cum`, cộng dồn qua cả chuỗi; trong trần ⇒ chạy; không cờ ⇒ như cũ', () => {
    const ghe = { tienMat: 1000, viThe: { btc: 3000, vang: 3000 } };
    const ban = (ma: string, moc: number) => ({ ma, chieu: 'ban' as const, moc_bp: moc });
    const con = { tranBanCon: 2000 };
    expect(lyDoTuChoi(ghe, [ban('btc', 10_000)], THO, ...TRONG, con)).toBe('gong_cum');
    expect(lyDoTuChoi(ghe, [ban('btc', 2 * THO)], THO, ...TRONG, con)).toBeNull();
    expect(lyDoTuChoi(ghe, [ban('btc', 2 * THO), ban('vang', 2 * THO)], THO, ...TRONG, con)).toBe('gong_cum');
    expect(xemTruocLenh(ghe, [ban('btc', 10_000)], THO, false)).not.toBeNull();
  });
});
