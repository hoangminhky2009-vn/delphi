/**
 * CHIA POT KHI CÓ NGƯỜI ALL-IN (side pot) — test VIẾT TRƯỚC, code sau.
 *
 * Đây là phần dễ sai nhất của poker, và sai thì chip bị đẻ ra hoặc bị nuốt âm
 * thầm. Kỷ luật A8.3 (test trước cho phần đụng tiền) áp cả cho chip ảo: sai ở
 * đây là hỏng tính công bằng của cả trò chơi, và người chơi không bao giờ
 * chứng minh được là mình bị thiệt.
 *
 * HAI LUẬT TÁCH BIỆT — bản nháp đầu của chính file này lẫn hai cái làm một:
 *
 *   (1) ALL-IN ÍT HƠN → TÁCH POT PHỤ. Người all-in chỉ tranh phần họ đủ sức
 *       theo; phần dư của người giàu hơn thành pot phụ họ không đụng tới.
 *
 *   (2) CƯỢC KHÔNG AI ĐỐI ĐƯỢC → TRẢ LẠI, không tạo pot. Tố 900 mà cả bàn chỉ
 *       theo nổi 100 thì 800 quay về túi, không phải "thắng" nó.
 *
 *   Pot có ĐÚNG MỘT người tranh vẫn HỢP LỆ khi những người khác BỎ BÀI —
 *   tiền của người bỏ là tiền chết, người trụ lại ăn cả.
 */
import { describe, expect, it } from 'vitest';
import { chiaPot, chiaPotDayDu } from '../server/holdem/pot.js';

describe('1. Không ai all-in — một pot duy nhất', () => {
  it('ba người góp bằng nhau → một pot, cả ba đều tranh', () => {
    const pots = chiaPot(new Map([['a', 300], ['b', 300], ['c', 300]]), new Set());
    expect(pots).toHaveLength(1);
    expect(pots[0]!.so_tien).toBe(900);
    expect([...pots[0]!.du_tranh].sort()).toEqual(['a', 'b', 'c']);
  });

  it('người BỎ vẫn để tiền lại trong pot nhưng KHÔNG được tranh', () => {
    const pots = chiaPot(new Map([['a', 300], ['b', 300], ['c', 300]]), new Set(['c']));
    expect(pots[0]!.so_tien, 'tiền người bỏ là tiền chết, vẫn nằm trong pot').toBe(900);
    expect([...pots[0]!.du_tranh].sort()).toEqual(['a', 'b']);
  });
});

describe('2. 🔴 ALL-IN ÍT HƠN → tách pot phụ', () => {
  it('a all-in 100, b/c theo 500: pot chính 300 (cả ba), pot phụ 800 (b,c)', () => {
    const pots = chiaPot(new Map([['a', 100], ['b', 500], ['c', 500]]), new Set());
    expect(pots).toHaveLength(2);

    expect(pots[0]!.so_tien).toBe(300);                       // 3 × 100
    expect([...pots[0]!.du_tranh].sort()).toEqual(['a', 'b', 'c']);

    expect(pots[1]!.so_tien).toBe(800);                       // 2 × 400
    expect([...pots[1]!.du_tranh].sort(), 'a KHÔNG được tranh pot phụ')
      .toEqual(['b', 'c']);
  });

  it('ba tầng all-in 100 / 250 / 500 → ba pot lồng nhau', () => {
    const pots = chiaPot(new Map([['a', 100], ['b', 250], ['c', 500], ['d', 500]]), new Set());
    expect(pots).toHaveLength(3);
    expect(pots[0]!.so_tien).toBe(400);                       // 4 × 100
    expect([...pots[0]!.du_tranh].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(pots[1]!.so_tien).toBe(450);                       // 3 × 150
    expect([...pots[1]!.du_tranh].sort()).toEqual(['b', 'c', 'd']);
    expect(pots[2]!.so_tien).toBe(500);                       // 2 × 250
    expect([...pots[2]!.du_tranh].sort()).toEqual(['c', 'd']);
  });
});

describe('3. 🔴 CƯỢC KHÔNG AI ĐỐI ĐƯỢC → trả lại, không tạo pot', () => {
  it('c tố 900 mà bàn chỉ theo nổi 100 → 800 quay về túi c', () => {
    const { pots, tra_lai } = chiaPotDayDu(
      new Map([['a', 100], ['b', 100], ['c', 900]]), new Set());
    expect(tra_lai.get('c'), 'phần vượt mức cao nhì phải trả lại').toBe(800);
    expect(pots.reduce((x, p) => x + p.so_tien, 0)).toBe(300);   // 3 × 100
  });

  it('không có phần thừa thì không trả lại đồng nào', () => {
    const { tra_lai } = chiaPotDayDu(new Map([['a', 300], ['b', 300]]), new Set());
    expect(tra_lai.size).toBe(0);
  });
});

describe('4. BẤT BIẾN — không đẻ chip, không nuốt chip', () => {
  const caTest: [string, [string, number][], string[]][] = [
    ['đều nhau', [['a', 300], ['b', 300], ['c', 300]], []],
    ['một all-in', [['a', 100], ['b', 500], ['c', 500]], []],
    ['ba tầng', [['a', 100], ['b', 250], ['c', 500], ['d', 500]], []],
    ['có người bỏ', [['a', 100], ['b', 500], ['c', 500]], ['a']],
    ['thừa không ai đối', [['a', 100], ['b', 100], ['c', 900]], []],
    ['lẻ', [['a', 333], ['b', 777], ['c', 111]], ['b']],
  ];
  for (const [ten, gopArr, bo] of caTest) {
    it(`"${ten}": tổng pot + trả lại = tổng góp`, () => {
      const gop = new Map(gopArr);
      const tong = [...gop.values()].reduce((x, y) => x + y, 0);
      const { pots, tra_lai } = chiaPotDayDu(gop, new Set(bo));
      const tongPot = pots.reduce((x, p) => x + p.so_tien, 0);
      const tongTra = [...tra_lai.values()].reduce((x, y) => x + y, 0);
      expect(tongPot + tongTra, `pot ${tongPot} + trả ${tongTra} ≠ góp ${tong}`).toBe(tong);
    });

    it(`"${ten}": mọi số tiền là SỐ NGUYÊN (C5)`, () => {
      const { pots, tra_lai } = chiaPotDayDu(new Map(gopArr), new Set(bo));
      for (const p of pots) expect(Number.isInteger(p.so_tien)).toBe(true);
      for (const v of tra_lai.values()) expect(Number.isInteger(v)).toBe(true);
    });
  }
});

describe('5. Ca biên', () => {
  it('không ai góp → không pot, không trả lại', () => {
    const { pots, tra_lai } = chiaPotDayDu(new Map(), new Set());
    expect(pots).toEqual([]);
    expect(tra_lai.size).toBe(0);
  });

  it('mọi người bỏ trừ một → pot MỘT người tranh là HỢP LỆ, ăn cả tiền chết', () => {
    const pots = chiaPot(new Map([['a', 300], ['b', 300]]), new Set(['b']));
    expect(pots).toHaveLength(1);
    expect(pots[0]!.du_tranh).toEqual(['a']);
    expect(pots[0]!.so_tien).toBe(600);
  });

  it('người bỏ giữa chừng góp ÍT hơn vẫn không sinh pot phụ vô nghĩa', () => {
    // b bỏ sau khi góp 100, a và c theo tới 500. Tiền của b là tiền chết nằm
    // ở pot chính; không được tạo pot phụ mà chỉ b đủ điều kiện.
    const pots = chiaPot(new Map([['a', 500], ['b', 100], ['c', 500]]), new Set(['b']));
    for (const p of pots) {
      expect(p.du_tranh, 'pot không được có người đã bỏ').not.toContain('b');
      expect(p.du_tranh.length).toBeGreaterThan(0);
    }
    expect(pots.reduce((x, p) => x + p.so_tien, 0)).toBe(1100);
  });
});

describe('6. v54 (D403) — `gop_theo_pot`: ai góp bao nhiêu vào TỪNG pot (trần phần một ghế trả phần vượt theo đó)', () => {
  const doc = (ds: Map<string, number>[]) => ds.map((m) => Object.fromEntries([...m].sort()));

  it('pot phụ: a tất tay 100 ⇒ pot chính {a,b,c: 100} · pot phụ {b,c: 400}', () => {
    const { pots, gop_theo_pot } = chiaPotDayDu(new Map([['a', 100], ['b', 500], ['c', 500]]), new Set());
    expect(pots.map((p) => p.so_tien)).toEqual([300, 800]);
    expect(doc(gop_theo_pot)).toEqual([{ a: 100, b: 100, c: 100 }, { b: 400, c: 400 }]);
  });

  it('⭐ hai tầng GỘP (cùng người tranh) thì phần góp cũng gộp — người bỏ vẫn có dòng (tiền họ nằm trong pot)', () => {
    // a bỏ sau khi góp 100 ⇒ hai tầng [0–100] và [100–500] cùng danh sách tranh {b, c} ⇒ MỘT pot 1.100.
    const { pots, gop_theo_pot } = chiaPotDayDu(new Map([['a', 100], ['b', 500], ['c', 500]]), new Set(['a']));
    expect(pots).toEqual([{ so_tien: 1100, du_tranh: ['b', 'c'] }]);
    expect(doc(gop_theo_pot)).toEqual([{ a: 100, b: 500, c: 500 }]);
  });

  it('song song và cân: một map mỗi pot, tổng từng map = tiền pot đó', () => {
    const gop = new Map([['a', 120], ['b', 260], ['c', 380], ['d', 380], ['e', 90]]);
    const { pots, gop_theo_pot } = chiaPotDayDu(gop, new Set(['d']));
    expect(gop_theo_pot).toHaveLength(pots.length);
    pots.forEach((p, i) => expect([...gop_theo_pot[i]!.values()].reduce((x, y) => x + y, 0), `pot ${i}`).toBe(p.so_tien));
  });
});

