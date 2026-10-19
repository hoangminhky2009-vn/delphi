/**
 * ENGINE v10 — LÕI NAV: vị thế có KÍCH CỠ TIỀN, NAV = tiền mặt + danh mục.
 *
 * TEST VIẾT TRƯỚC CODE (A8.3 — phần đụng tiền phải có vector tính tay đi trước).
 * Mọi số trong file này tính tay, ghi cả phép tính — sai một floor là đọc ra ngay.
 *
 * Đây là bản thi hành D40 + spec 01: thứ giết bệnh "Vốn đứng im" (D35 chẩn:
 * `pnl_bp` là thước xếp hạng, không bao giờ chạm `von`). Sau v10: giá cắn thẳng
 * vào giá trị vị thế ⇒ NAV ⇒ cháy thật, và phân bổ 35% khác hẳn phân bổ 70%.
 */
import { describe, expect, it } from 'vitest';
import {
  apDinhGia, apLamPhat, apLenhGiaoDich, daChayNav,
  giaiLenhMoc, mocHopLe, navCua, tienTuMoc, type GheNav,
} from '../server/holdem/nav.js';
import { NAV_V10 } from '../config/holdem.js';

const ghe = (von: number, viThe: Record<string, number> = {}): GheNav =>
  ({ von, vi_the: { ...viThe } });

describe('VECTOR TAY 1 — mua có trượt giá', () => {
  it('mua 1.000 vào BTC (mỏng, 120bp): trượt 12, vị thế +988, tiền mặt −1.000', () => {
    // trượt = floor(1000 × 120 / 10000) = 12 ; vào vị thế = 1000 − 12 = 988
    const g = ghe(10000);
    const r = apLenhGiaoDich(g, [{ ma: 'btc', tien: 1000 }]);
    expect(r.loi).toBeNull();
    expect(g.von).toBe(9000);
    expect(g.vi_the.btc).toBe(988);
    expect(r.phi_quy).toBe(12);
    expect(navCua(g)).toBe(9988);   // NAV mất đúng phần trượt, không hơn
  });

  it('bán 500 từ vị thế vàng (vừa, 60bp): trượt 3, tiền mặt +497', () => {
    // trượt = floor(500 × 60 / 10000) = 3
    const g = ghe(1000, { vang: 2000 });
    const r = apLenhGiaoDich(g, [{ ma: 'vang', tien: -500 }]);
    expect(r.loi).toBeNull();
    expect(g.vi_the.vang).toBe(1500);
    expect(g.von).toBe(1497);
    expect(r.phi_quy).toBe(3);
  });

  it('bán SẠCH một mã thì xoá hẳn ô — vị thế 0 không phải vị thế', () => {
    const g = ghe(0, { usd: 300 });
    apLenhGiaoDich(g, [{ ma: 'usd', tien: -300 }]);
    expect('usd' in g.vi_the).toBe(false);
  });
});

describe('VECTOR TAY 2 — từ chối phải NÓI RA, và không áp nửa chừng', () => {
  it('mua quá tiền mặt → từ chối, KHÔNG trừ gì', () => {
    const g = ghe(500);
    const r = apLenhGiaoDich(g, [{ ma: 'btc', tien: 600 }]);
    expect(r.loi).toBe('khong_du_tien');
    expect(g.von).toBe(500);
    expect(navCua(g)).toBe(500);
  });

  it('bán quá vị thế → từ chối', () => {
    const g = ghe(0, { vang: 100 });
    expect(apLenhGiaoDich(g, [{ ma: 'vang', tien: -200 }]).loi).toBe('khong_du_vi_the');
  });

  it('mã không tồn tại → từ chối (id rác không được thành tiền)', () => {
    expect(apLenhGiaoDich(ghe(1000), [{ ma: 'xxx', tien: 100 }]).loi)
      .toBe('ma_khong_ton_tai');
  });

  it('vượt trần số mã đồng thời → từ chối lệnh MỞ MÃ MỚI, mua thêm mã cũ vẫn được', () => {
    const g = ghe(10000, { btc: 100, vang: 100, usd: 100 });
    expect(apLenhGiaoDich(g, [{ ma: 'tpcp', tien: 100 }], { maxTaiSan: 3 }).loi)
      .toBe('day_tai_san');
    expect(apLenhGiaoDich(g, [{ ma: 'btc', tien: 100 }], { maxTaiSan: 3 }).loi)
      .toBeNull();
  });

  /*
   * MỘT CHUỖI LỆNH LÀ MỘT KHỐI: lệnh 2 hỏng thì lệnh 1 cũng không áp.
   * Áp nửa chừng là log ghi một nửa sự thật — replay dựng lại đúng một nửa.
   */
  it('chuỗi có một lệnh hỏng → cả chuỗi không áp', () => {
    const g = ghe(1000, { vang: 500 });
    const r = apLenhGiaoDich(g, [
      { ma: 'vang', tien: -200 },
      { ma: 'btc', tien: 5000 },     // quá tiền — hỏng
    ]);
    expect(r.loi).toBe('khong_du_tien');
    expect(g.von).toBe(1000);
    expect(g.vi_the.vang).toBe(500);
  });
});

describe('VECTOR TAY 3 — định giá cắn vào vị thế (thứ giết "Vốn đứng im")', () => {
  it('BTC +500bp trên vị thế 988: floor(988 × 10500 / 10000) = 1.037', () => {
    const g = ghe(9000, { btc: 988 });
    const r = apDinhGia(g, { btc: 500 }, 0);
    expect(g.vi_the.btc).toBe(1037);
    expect(navCua(g)).toBe(10037);
    // Mắt xích tiền: đúng phần vị thế đổi, tổng khớp NAV delta.
    expect(r.tien_theo_ma.btc).toBe(49);
  });

  it('lỗ −9.999bp không âm được vị thế; −10.000bp về đúng 0', () => {
    const g = ghe(0, { btc: 100 });
    apDinhGia(g, { btc: -10000 }, 0);
    expect(g.vi_the.btc ?? 0).toBe(0);
    expect(navCua(g)).toBe(0);
  });

  it('phần danh mục (thẻ chiến thuật) áp SAU phần riêng từng mã, trên tổng', () => {
    /*
     * riêng: btc +1000bp → 1100 ; vang −500bp → 950
     * danh mục +200bp áp lên từng vị thế SAU đó:
     *   btc: floor(1100×10200/10000)=1122 ; vang: floor(950×10200/10000)=969
     */
    const g = ghe(0, { btc: 1000, vang: 1000 });
    apDinhGia(g, { btc: 1000, vang: -500 }, 200);
    expect(g.vi_the.btc).toBe(1122);
    expect(g.vi_the.vang).toBe(969);
  });
});

describe('VECTOR TAY 4 — lạm phát tiền mặt + cháy theo NAV', () => {
  it('lạm phát 150bp trên 10.000 tiền mặt = 150; vị thế KHÔNG bị chạm', () => {
    const g = ghe(10000, { btc: 5000 });
    const mat = apLamPhat(g);
    expect(mat).toBe(150);
    expect(g.von).toBe(9850);
    expect(g.vi_the.btc).toBe(5000);
  });

  it('lạm phát floor: 65 tiền mặt → mất 0 (floor(65×150/10000)=0)', () => {
    const g = ghe(65);
    expect(apLamPhat(g)).toBe(0);
  });

  it('cháy khi NAV ≤ 10% vốn khởi điểm — tính CẢ vị thế, khoá không cứu', () => {
    expect(daChayNav(ghe(500, { btc: 400 }), 10000)).toBe(true);    // NAV 900 < 1000
    expect(daChayNav(ghe(500, { btc: 600 }), 10000)).toBe(false);   // NAV 1100
    expect(daChayNav(ghe(1000), 10000)).toBe(true);                  // đúng ngưỡng = cháy
  });
});

describe('VECTOR TAY 5 — mốc 5% và bước 10 (C5, spec 01 §4.2b)', () => {
  it('35% của 9.870 tiền mặt = 3.454,5 → floor về bước 10 = 3.450', () => {
    expect(tienTuMoc(3500, 9870)).toBe(3450);
  });
  it('100% = dồn HẾT, không bị bước 10 cắt (all-in phải là all-in thật)', () => {
    expect(tienTuMoc(10000, 9873)).toBe(9873);
  });
  it('mốc ngoài thang / tiền 0 → 0', () => {
    expect(tienTuMoc(0, 5000)).toBe(0);
    expect(tienTuMoc(10500, 5000)).toBe(0);
    expect(tienTuMoc(500, 0)).toBe(0);
  });
});

/*
 * (VECTOR TAY 6 đã GỠ 01/08 cùng `chiaQuyTheoTangTruong` — audit đường tiền
 * phát hiện hàm được import mà KHÔNG một đường gọi nào trong engine: chia quỹ
 * thật đi đường pnl_bp := tăng trưởng NAV → chiaQuyVong (engine ~2422). Hàm
 * chết có test xanh là "cơ chế trang trí" lần 12 — loại nguy hiểm nhất.)
 */

describe('BẤT BIẾN HỆ KÍN — mua bán vòng vo không sinh tiền', () => {
  it('mua rồi bán ngay: NAV chỉ mất đúng 2 lần trượt giá', () => {
    const g = ghe(10000);
    apLenhGiaoDich(g, [{ ma: 'btc', tien: 1000 }]);   // trượt 12, vị thế 988
    apLenhGiaoDich(g, [{ ma: 'btc', tien: -988 }]);   // trượt floor(988×120/1e4)=11
    // NAV = 10000 − 12 − 11 = 9977; không đường nào ra hơn 10000.
    expect(navCua(g)).toBe(9977);
  });
});

/*
 * MỐC THÔ/MỊN — ĐẶC QUYỀN CHIA LỆNH (founder 28/07: "Chỉ chiến thuật chia lệnh
 * mới cho phép đi vốn cụ thể (các mốc 5-10-15...100) Còn người chơi chưa có
 * chiến thuật chia lệnh chỉ có thể đi vốn cố định các mốc lớn hơn").
 */
describe('MỐC — thô mặc định, mịn là đặc quyền Chia Lệnh', () => {
  it('không Chia Lệnh: 25/50/75/100 hợp lệ, 5/10/35 KHÔNG', () => {
    for (const m of [2500, 5000, 7500, 10000]) expect(mocHopLe(m, false)).toBe(true);
    for (const m of [500, 1000, 3500, 9500]) expect(mocHopLe(m, false)).toBe(false);
  });
  it('có Chia Lệnh: mọi bội 5% hợp lệ, 3%/7% vẫn KHÔNG (không có mốc tuỳ ý)', () => {
    for (const m of [500, 3500, 6500, 9500, 10000]) expect(mocHopLe(m, true)).toBe(true);
    for (const m of [300, 700, 1, 10001, 0, -500]) expect(mocHopLe(m, true)).toBe(false);
  });

  it('VECTOR TAY — giải tuần tự: lệnh sau tính trên số dư SAU lệnh trước', () => {
    /*
     * von 10.000, thô: mua btc 50% = 5.000 → còn 5.000; mua vang 50% của
     * 5.000 = 2.500 → hai lệnh KHÁC tiền dù cùng mốc. Đây chính là chỗ "xử lý
     * kỹ": giải cả chuỗi trên MỘT mốc ví đầu vòng là hai lệnh cùng 5.000 và
     * lệnh hai thất bại — hoặc tệ hơn, đi lọt 10.000 tổng.
     */
    const g = ghe(10000);
    const r = giaiLenhMoc(g, [
      { ma: 'btc', chieu: 'mua', moc_bp: 5000 },
      { ma: 'vang', chieu: 'mua', moc_bp: 5000 },
    ], false);
    expect(r.loi).toBeNull();
    expect(r.lenh).toEqual([
      { ma: 'btc', tien: 5000 },
      { ma: 'vang', tien: 2500 },
    ]);
  });

  it('mốc sai bước → TỪ CHỐI CẢ CHUỖI, không lặng lẽ làm tròn', () => {
    const g = ghe(10000);
    const r = giaiLenhMoc(g, [
      { ma: 'btc', chieu: 'mua', moc_bp: 2500 },
      { ma: 'vang', chieu: 'mua', moc_bp: 500 },   // mịn mà không có lá
    ], false);
    expect(r.loi).toBe('moc_khong_hop_le');
    expect(r.lenh).toEqual([]);
  });

  it('BÁN GIẢI TRƯỚC MUA — bất kể thứ tự bấm (founder dính 01/08)', () => {
    /*
     * Luật cũ giải theo thứ tự bấm: all-in xong tiền mặt 0, danh sách
     * [MUA mã mới, BÁN mã cũ] thì mua đứng trước giải ra 0 đồng — người chơi
     * "đ** bán được". Luật mới: bán tất toán trước (như broker bù tiền trong
     * ngày), mua ăn tiền vừa về. Chuỗi [mua btc, ban btc ALL] vì thế thành:
     * bán trước (chưa có gì → bỏ), mua sau → vị thế CÒN — đổi mã trong một
     * vòng nay viết là [ban cũ, mua mới], không còn vòng quay mua-bán ảo.
     */
    const g = ghe(1000);
    const r = giaiLenhMoc(g, [
      { ma: 'btc', chieu: 'mua', moc_bp: 5000 },
      { ma: 'btc', chieu: 'ban', moc_bp: 10000 },
    ], false);
    expect(r.loi).toBeNull();
    expect(r.lenh).toEqual([{ ma: 'btc', tien: 500 }]);

    // Kịch bản founder: cầm btc (ví cạn), bấm [mua usd 50%, bán btc ALL].
    const camBtc = { von: 0, vi_the: { btc: 494 } };
    const r2 = giaiLenhMoc(camBtc, [
      { ma: 'usd', chieu: 'mua', moc_bp: 5000 },
      { ma: 'btc', chieu: 'ban', moc_bp: 10000 },
    ], false);
    expect(r2.loi).toBeNull();
    // Bán −494 về tiền trước, rồi mua 50% số tiền vừa về — không kẹt nữa.
    expect(r2.lenh[0]).toEqual({ ma: 'btc', tien: -494 });
    expect(r2.lenh[1]!.ma).toBe('usd');
    expect(r2.lenh[1]!.tien).toBeGreaterThan(0);
  });

  it('mốc trên ví rỗng = không làm gì, không phải lỗi', () => {
    const r = giaiLenhMoc(ghe(0), [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }], false);
    expect(r.loi).toBeNull();
    expect(r.lenh).toEqual([]);
  });

  it('giải KHÔNG đụng ghế thật — chỉ trả chuỗi tiền', () => {
    const g = ghe(10000);
    giaiLenhMoc(g, [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }], false);
    expect(g.von).toBe(10000);
    expect(g.vi_the).toEqual({});
  });
});
