/**
 * VÒNG CƯỢC TUẦN TỰ — soi đúng ba thứ mô hình cũ KHÔNG có.
 *
 * Founder hỏi thẳng 20/07: "cơ chế giữ, cược, tố đã giống Poker chưa?"
 * Đo ra là CHƯA, và ba lỗ hổng dưới đây là lý do. File này khoá cả ba.
 */
import { describe, expect, it } from 'vitest';
import {
  daDongVong, duocLam, hanhDong, LoiCuoc, moVongCuoc, tongGop,
  type GheCuoc,
} from '../server/holdem/cuoc.js';

const BAN: GheCuoc[] = [
  { id: 'a', von: 10000 },
  { id: 'b', von: 10000 },
  { id: 'c', von: 10000 },
];

describe('1. 🔴 THEO LÀ MỘT LỰA CHỌN — lỗ hổng nặng nhất của bản cũ', () => {
  it('b tố thì tới lượt c QUYẾT ĐỊNH, không bị trừ tiền tự động', () => {
    let tt = moVongCuoc(BAN, 500);
    expect(tt.luot).toBe('a');
    tt = hanhDong(tt, 'a', 'theo');
    tt = hanhDong(tt, 'b', 'to', 3000);

    // Tới lượt c — và c CHƯA mất đồng nào ngoài cược nền.
    expect(tt.luot).toBe('c');
    expect(tt.gop.get('c')).toBe(500);

    const lam = duocLam(tt)!;
    expect(lam.ghe_id).toBe('c');
    expect(lam.gia_phai_theo).toBe(3500);
    expect(lam.con_thieu).toBe(3000);
    expect(lam.duoc.sort()).toEqual(['bo', 'theo', 'to']);
  });

  it('c BỎ thì chỉ mất phần đã góp, không bị ép theo giá', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'theo');
    tt = hanhDong(tt, 'b', 'to', 3000);
    tt = hanhDong(tt, 'c', 'bo');
    expect(tt.gop.get('c'), 'bỏ rồi thì không góp thêm đồng nào').toBe(500);
    expect(tt.daBo.has('c')).toBe(true);
  });

  it('hành động sai lượt bị TỪ CHỐI', () => {
    const tt = moVongCuoc(BAN, 500);
    expect(() => hanhDong(tt, 'c', 'theo')).toThrow(LoiCuoc);
  });
});

describe('2. 🔴 TỐ LẠI — vòng chưa đóng khi còn người chưa đáp', () => {
  it('sau cú tố, MỌI người phải được hỏi lại', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'theo');
    tt = hanhDong(tt, 'b', 'theo');
    tt = hanhDong(tt, 'c', 'to', 2000);
    // a và b đã hành động rồi, nhưng c vừa tố → phải hỏi lại từ a.
    expect(tt.luot).toBe('a');
    expect(daDongVong(tt)).toBe(false);
  });

  it('tố lại nhiều lần vẫn chạy đúng, giá tăng dần', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'to', 1000);   // giá 1500
    expect(tt.gia).toBe(1500);
    tt = hanhDong(tt, 'b', 'to', 2000);   // b góp thêm 2000 → 2500
    expect(tt.gia).toBe(2500);
    tt = hanhDong(tt, 'c', 'bo');
    tt = hanhDong(tt, 'a', 'theo');       // a bù cho đủ 2500
    expect(tt.gop.get('a')).toBe(2500);
    expect(daDongVong(tt), 'a theo xong, b là người tố cuối → đóng').toBe(true);
  });

  it('mọi người CHECK hết → vòng đóng sau đúng một lượt mỗi người', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'theo');
    tt = hanhDong(tt, 'b', 'theo');
    expect(daDongVong(tt)).toBe(false);
    tt = hanhDong(tt, 'c', 'theo');
    expect(daDongVong(tt)).toBe(true);
    expect(tongGop(tt)).toBe(1500);
  });

  it('chỉ còn MỘT người chưa bỏ → đóng ngay, không hỏi tiếp', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'to', 2000);
    tt = hanhDong(tt, 'b', 'bo');
    tt = hanhDong(tt, 'c', 'bo');
    expect(daDongVong(tt)).toBe(true);
  });
});

describe('3. 🔴 ALL-IN KHÔNG ĐỦ GIÁ — bản cũ đá thẳng ra khỏi vòng', () => {
  const LECH: GheCuoc[] = [
    { id: 'giau', von: 10000 },
    { id: 'ngheo', von: 1200 },
    { id: 'vua', von: 5000 },
  ];

  it('người ít vốn ALL-IN được, KHÔNG bị coi là bỏ bài', () => {
    let tt = moVongCuoc(LECH, 500);
    tt = hanhDong(tt, 'giau', 'to', 4000);      // giá 4500
    tt = hanhDong(tt, 'ngheo', 'theo');         // chỉ còn 700 → all-in
    expect(tt.daBo.has('ngheo'), 'all-in KHÔNG phải bỏ bài').toBe(false);
    expect(tt.allIn.has('ngheo')).toBe(true);
    expect(tt.gop.get('ngheo')).toBe(1200);
    expect(tt.vonConLai.get('ngheo')).toBe(0);
  });

  it('người đã all-in KHÔNG bị hỏi lại dù sau đó có tố tiếp', () => {
    let tt = moVongCuoc(LECH, 500);
    tt = hanhDong(tt, 'giau', 'to', 4000);
    tt = hanhDong(tt, 'ngheo', 'theo');         // all-in
    tt = hanhDong(tt, 'vua', 'to', 4500);       // dồn hết 4500 → tố lên 5000
    // Phải quay về hỏi 'giau', tuyệt đối không hỏi 'ngheo' nữa.
    expect(tt.luot).toBe('giau');
    let buoc = 0;
    while (!daDongVong(tt) && buoc < 12) {
      expect(tt.luot, 'không được hỏi người đã all-in').not.toBe('ngheo');
      tt = hanhDong(tt, tt.luot!, 'theo');
      buoc += 1;
    }
    expect(daDongVong(tt)).toBe(true);
  });

  it('cược nền lớn hơn vốn → all-in ngay từ đầu, không âm vốn', () => {
    const tt = moVongCuoc([{ id: 'x', von: 200 }, { id: 'y', von: 9000 }], 500);
    expect(tt.gop.get('x')).toBe(200);
    expect(tt.vonConLai.get('x')).toBe(0);
    expect(tt.allIn.has('x')).toBe(true);
  });
});

describe('3b. TỐ PHẢI RA TỐ — không im lặng biến thành theo', () => {
  it('tố ít hơn mức phải theo → NÉM LỖI, không âm thầm thành theo', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'to', 4000);     // giá 4500
    // b đã góp 500, phải bù 4000 mới đủ. Tố 1000 là vô nghĩa.
    expect(() => hanhDong(tt, 'b', 'to', 1000)).toThrow(LoiCuoc);
  });

  it('nhưng DỒN HẾT VỐN mà vẫn không vượt giá thì HỢP LỆ (all-in)', () => {
    let tt = moVongCuoc([
      { id: 'a', von: 10000 }, { id: 'b', von: 900 }, { id: 'c', von: 10000 },
    ], 500);
    tt = hanhDong(tt, 'a', 'to', 4000);
    // b chỉ còn 400, dồn hết cũng mới 900 < 4500 → vẫn phải cho all-in.
    expect(() => hanhDong(tt, 'b', 'to', 400)).not.toThrow();
  });
});

describe('4. BẤT BIẾN — không đẻ chip, không góp quá túi', () => {
  it('không ai góp quá vốn ban đầu của mình', () => {
    let tt = moVongCuoc(BAN, 500);
    let buoc = 0;
    while (!daDongVong(tt) && buoc < 30) {
      const l = duocLam(tt)!;
      tt = hanhDong(tt, l.ghe_id, buoc % 3 === 0 ? 'to' : 'theo', 1500);
      buoc += 1;
    }
    for (const g of BAN) {
      expect(tt.gop.get(g.id)!, `${g.id} góp quá túi`).toBeLessThanOrEqual(g.von);
      expect(tt.vonConLai.get(g.id)!).toBeGreaterThanOrEqual(0);
    }
  });

  it('góp + còn lại = vốn ban đầu, mọi lúc', () => {
    let tt = moVongCuoc(BAN, 500);
    tt = hanhDong(tt, 'a', 'to', 2500);
    tt = hanhDong(tt, 'b', 'theo');
    tt = hanhDong(tt, 'c', 'bo');
    for (const g of BAN) {
      expect((tt.gop.get(g.id) ?? 0) + (tt.vonConLai.get(g.id) ?? 0)).toBe(g.von);
    }
  });

  it('mọi số là SỐ NGUYÊN (C5)', () => {
    let tt = moVongCuoc(BAN, 333);
    tt = hanhDong(tt, 'a', 'to', 777);
    for (const v of tt.gop.values()) expect(Number.isInteger(v)).toBe(true);
    for (const v of tt.vonConLai.values()) expect(Number.isInteger(v)).toBe(true);
  });

  it('hàm thuần — hành động KHÔNG sửa trạng thái cũ tại chỗ', () => {
    const tt0 = moVongCuoc(BAN, 500);
    const chup = new Map(tt0.gop);
    hanhDong(tt0, 'a', 'to', 3000);
    expect(tt0.gop).toEqual(chup);
    expect(tt0.gia).toBe(500);
  });
});
