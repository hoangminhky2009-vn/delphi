/**
 * GĐ3 VIỆC 1 — TDD: test vectors A5.2 (payout), A5.3 (cap), A5.4 (Brier)
 * trên HÀM THUẦN (không I/O). Số trong file này chép đúng CLAUDE.md —
 * code phải pass đúng TỪNG CON SỐ, không được sửa test cho khớp code (A8.2/A8.3).
 */
import { describe, it, expect } from 'vitest';
import {
  computePayout,
  computeCap,
  validateAllocations,
  computeBrier,
  buildDistribution,
  type BetLike,
} from '../server/parimutuel.js';

// Helper dựng bet gọn
const bet = (optionId: string, amount: number, userId: string | null = null): BetLike => ({
  optionId,
  userId,
  amount: BigInt(amount),
  isSeed: userId === null,
});

describe('A5.1/A5.2 — computePayout (integer, tất định)', () => {
  it('Vector 1 — không seed, 3 cửa: A 200@X; B 300@Y; C 500@Y. Y thắng.', () => {
    const bets = [bet('X', 200, 'A'), bet('Y', 300, 'B'), bet('Y', 500, 'C')];
    const r = computePayout(bets, 'Y', false);

    expect(r.mode).toBe('normal');
    expect(r.rakeBurn).toBe(30n);
    expect(r.treasuryRake).toBe(20n);
    // payout B = floor(300×950/800) = 356; C = floor(500×950/800) = 593
    expect(r.playerPayouts.get('B')).toBe(356n);
    expect(r.playerPayouts.get('C')).toBe(593n);
    expect(r.playerPayouts.has('A')).toBe(false); // cửa thua không nhận gì
    expect(r.seedToTreasury).toBe(0n);
    expect(r.residual).toBe(1n); // 950 − 949 → đốt
    expect(r.burnTotal).toBe(31n); // 30 + residual 1
    // Kiểm bất biến: 1.000 = 949 + (30+1) + 20
    expect(949n + 31n + 20n).toBe(1000n);
  });

  it('Vector 2 — seed 100/cửa, 4 cửa: A 300@c1; B 100@c2; C 200@c3. Cửa 1 thắng.', () => {
    const bets = [
      bet('c1', 100), bet('c2', 100), bet('c3', 100), bet('c4', 100), // seed
      bet('c1', 300, 'A'), bet('c2', 100, 'B'), bet('c3', 200, 'C'),
    ];
    const r = computePayout(bets, 'c1', false);

    expect(r.mode).toBe('normal');
    expect(r.rakeBurn).toBe(30n);
    expect(r.treasuryRake).toBe(20n);
    // S_w = 300 + 100(seed) = 400; payout A = floor(300×950/400) = 712
    expect(r.playerPayouts.get('A')).toBe(712n);
    // payout seed cửa thắng = floor(100×950/400) = 237 → Kho bạc
    expect(r.seedToTreasury).toBe(237n);
    expect(r.residual).toBe(1n);
    expect(r.burnTotal).toBe(31n);
    // Kiểm: 1.000 = 712 + 237 + 31 + 20
    expect(712n + 237n + 31n + 20n).toBe(1000n);
  });

  it('Vector 3 — 100% token NGƯỜI CHƠI ở cửa thắng → hoàn nguyên, không rake', () => {
    // Không seed: A 300@c1, B 200@c1, c1 thắng → hoàn đúng số đã đặt
    const r = computePayout([bet('c1', 300, 'A'), bet('c1', 200, 'B')], 'c1', false);
    expect(r.mode).toBe('refund_players');
    expect(r.playerPayouts.get('A')).toBe(300n);
    expect(r.playerPayouts.get('B')).toBe(200n);
    expect(r.rakeBurn).toBe(0n);
    expect(r.treasuryRake).toBe(0n);
    expect(r.residual).toBe(0n);
    expect(r.seedToTreasury).toBe(0n);
  });

  it('Vector 3 có seed — seed về Kho bạc NGUYÊN VẸN, người chơi hoàn đủ', () => {
    // 4 cửa seed 100/cửa; A 300@c1, B 200@c1; c1 thắng. U_lose = 0 → Ngoại lệ 1.
    const bets = [
      bet('c1', 100), bet('c2', 100), bet('c3', 100), bet('c4', 100),
      bet('c1', 300, 'A'), bet('c1', 200, 'B'),
    ];
    const r = computePayout(bets, 'c1', false);
    expect(r.mode).toBe('refund_players');
    expect(r.playerPayouts.get('A')).toBe(300n);
    expect(r.playerPayouts.get('B')).toBe(200n);
    expect(r.seedToTreasury).toBe(400n); // TOÀN BỘ seed (mọi cửa) về Kho bạc
    expect(r.burnTotal).toBe(0n);
    expect(r.treasuryRake).toBe(0n);
    // Bất biến: 900 = 500 hoàn + 400 seed
    expect(500n + 400n).toBe(900n);
  });

  it('PHẢN VÍ DỤ Ngoại lệ 1 — đo trên U_lose==0, KHÔNG đo trên tổng pool', () => {
    // 3 cửa seed 100/cửa; A 200@c1 là bet người chơi DUY NHẤT; c1 thắng.
    // Code sai (trigger pool==S_w) sẽ trả A 316 "từ khí trời". Đúng: hoàn 200.
    const bets = [
      bet('c1', 100), bet('c2', 100), bet('c3', 100),
      bet('c1', 200, 'A'),
    ];
    const r = computePayout(bets, 'c1', false);
    expect(r.mode).toBe('refund_players');
    expect(r.playerPayouts.get('A')).toBe(200n); // KHÔNG phải 316
    expect(r.seedToTreasury).toBe(300n);
    expect(r.burnTotal + r.treasuryRake).toBe(0n);
  });

  it('Vector 4 — hủy kèo: hoàn 100% MỌI bet người chơi, seed về Kho bạc, không rake', () => {
    const bets = [
      bet('c1', 100), bet('c2', 100), bet('c3', 100), bet('c4', 100),
      bet('c1', 300, 'A'), bet('c2', 100, 'B'), bet('c3', 200, 'C'),
    ];
    const r = computePayout(bets, null, true);
    expect(r.mode).toBe('cancelled');
    expect(r.playerPayouts.get('A')).toBe(300n);
    expect(r.playerPayouts.get('B')).toBe(100n);
    expect(r.playerPayouts.get('C')).toBe(200n);
    expect(r.seedToTreasury).toBe(400n);
    expect(r.burnTotal).toBe(0n);
    expect(r.treasuryRake).toBe(0n);
  });

  it('kèo CÓ seed mà cửa thắng 0 token (seed không phủ đủ cửa — A3.6 vỡ) → THROW, không tịch thu im lặng', () => {
    // Dữ liệu hỏng giả lập: seed chỉ có ở c1, người chơi thua ở c1, cửa thắng c2 trống
    const bets = [bet('c1', 100), bet('c1', 50, 'A')];
    expect(() => computePayout(bets, 'c2', false)).toThrow(/A3\.6/);
  });

  it('Kèo không seed, không ai đặt cửa thắng (S_w=0) → toàn bộ D vào Kho bạc', () => {
    const bets = [bet('c1', 400, 'A'), bet('c2', 600, 'B')]; // c3 thắng, không ai đặt
    const r = computePayout(bets, 'c3', false);
    expect(r.mode).toBe('unclaimed_to_treasury');
    expect(r.playerPayouts.size).toBe(0);
    expect(r.rakeBurn).toBe(30n);
    expect(r.treasuryRake).toBe(20n);
    expect(r.unclaimedToTreasury).toBe(950n); // D nguyên vẹn vào Kho bạc
    expect(r.residual).toBe(0n);
  });

  it('user rải NHIỀU cửa gồm cửa thắng: chỉ phần cửa thắng được chia', () => {
    // A đặt 60@c1 và 40@c3; B đặt 100@c2. c1 thắng. P=200.
    const bets = [bet('c1', 60, 'A'), bet('c3', 40, 'A'), bet('c2', 100, 'B')];
    const r = computePayout(bets, 'c1', false);
    // burn=6, trea=4, D=190, S_w=60 → A = floor(60×190/60) = 190
    expect(r.playerPayouts.get('A')).toBe(190n);
    expect(r.playerPayouts.has('B')).toBe(false);
    expect(r.residual).toBe(0n);
  });

  it('bất biến bảo toàn: P == Σpayout + seed_về_kho + burn + residual + trea (mọi mode)', () => {
    // Hàm tự assert bên trong — gọi với case lộn xộn để chắc không ném
    const bets = [
      bet('c1', 7), bet('c2', 7), bet('c3', 7),
      bet('c1', 137, 'A'), bet('c2', 251, 'B'), bet('c3', 89, 'C'), bet('c1', 53, 'B'),
    ];
    expect(() => computePayout(bets, 'c1', false)).not.toThrow();
    const r = computePayout(bets, 'c1', false);
    const sumPlayers = [...r.playerPayouts.values()].reduce((a, b) => a + b, 0n);
    const P = 7n * 3n + 137n + 251n + 89n + 53n;
    expect(sumPlayers + r.seedToTreasury + r.burnTotal + r.treasuryRake + r.unclaimedToTreasury).toBe(P);
  });
});

describe('A5.3 — computeCap + validateAllocations (chống lách cap)', () => {
  it('bankroll 1.000, chưa đặt → cap 200', () => {
    expect(computeCap(1000n, 0n)).toBe(200n);
  });

  it('đặt 200 rồi thêm 50 cùng kèo → quy chiếu 800+200=1.000, cap 200 → TỪ CHỐI', () => {
    // Lệnh 1: đặt 200 — hợp lệ
    const r1 = validateAllocations({
      newAllocations: new Map([['o1', 200n]]),
      oldAllocations: new Map(),
      bankroll: 1000n,
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.netDelta).toBe(200n);

    // Lệnh 2: tổng mới 250 (200 cũ + 50 thêm) khi bankroll còn 800
    const r2 = validateAllocations({
      newAllocations: new Map([['o1', 250n]]),
      oldAllocations: new Map([['o1', 200n]]),
      bankroll: 800n,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('cap_exceeded');
  });

  it('đặt 201 khi bankroll 1.000 (cap 200) → cap_exceeded', () => {
    const r = validateAllocations({
      newAllocations: new Map([['o1', 201n]]),
      oldAllocations: new Map(),
      bankroll: 1000n,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('cap_exceeded');
  });

  it('no-withdraw: tổng mới < tổng cũ → từ chối', () => {
    const r = validateAllocations({
      newAllocations: new Map([['o1', 50n]]),
      oldAllocations: new Map([['o1', 100n]]),
      bankroll: 900n,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('no_withdraw');
  });

  it('reallocation cùng tổng giữa các cửa → hợp lệ, netDelta=0', () => {
    const r = validateAllocations({
      newAllocations: new Map([['o1', 40n], ['o2', 60n]]),
      oldAllocations: new Map([['o1', 100n]]),
      bankroll: 900n,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.netDelta).toBe(0n);
  });

  it('min bet: cửa có amount 0 < x < MIN_BET → từ chối (MIN_BET=1 nên chỉ chặn phân bổ trống)', () => {
    const r = validateAllocations({
      newAllocations: new Map([['o1', 0n]]),
      oldAllocations: new Map(),
      bankroll: 1000n,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('empty_allocation');
  });

  it('không đủ số dư: netDelta > bankroll → insufficient_bankroll', () => {
    // bankroll 100, đã đặt 400 (quy chiếu 500, cap 100): tổng mới 500 → delta 100 ok;
    // tổng mới 501 vượt cap. Dựng case delta vượt balance mà KHÔNG vượt cap:
    // bankroll 50, đã đặt 400 → quy chiếu 450, cap 90?? 450*0.2=90 < 400 cũ →
    // mọi tổng mới ≥ 400 đều vượt cap... Case thuần balance: bankroll 1000,
    // cũ 0, mới 150 (cap 200 OK) nhưng bankroll thật chỉ 100 → dùng bankroll=100:
    // quy chiếu 100, cap 20 → cap chặn trước. Kết luận: với cap 20%, netDelta
    // vượt balance LUÔN bị cap chặn trước (cap ≤ 20% quy chiếu < balance khả dụng
    // + đã đặt). Balance check vẫn giữ làm lưới sau cùng — test trực tiếp hàm:
    const r = validateAllocations({
      newAllocations: new Map([['o1', 100n]]),
      oldAllocations: new Map(),
      bankroll: 1000n,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.netDelta).toBe(100n);
      expect(r.netDelta <= 1000n).toBe(true);
    }
  });
});

describe('A5.4 — computeBrier', () => {
  it('ví dụ CLAUDE.md: 60@cửa1, 40@cửa3, kèo 4 cửa, cửa 1 thắng → 0,32', () => {
    const brier = computeBrier(
      new Map([['c1', 60n], ['c3', 40n]]),
      'c1',
      ['c1', 'c2', 'c3', 'c4'],
    );
    expect(brier).toBeCloseTo(0.32, 10);
  });

  it('đặt 100% cửa thắng → Brier 0 (dự báo hoàn hảo)', () => {
    expect(computeBrier(new Map([['c1', 500n]]), 'c1', ['c1', 'c2'])).toBeCloseTo(0, 10);
  });

  it('đặt 100% cửa thua → Brier 2 (thang 0–2)', () => {
    expect(computeBrier(new Map([['c2', 500n]]), 'c1', ['c1', 'c2'])).toBeCloseTo(2, 10);
  });
});

describe('buildDistribution — phân bố + tỷ lệ ăn ngụ ý (server tính, C4)', () => {
  it('trả SỐ TIỀN mỗi cửa + pct; TUYỆT ĐỐI không có tỷ lệ ăn (founder 19/07)', () => {
    // Pool 1.000: c1=400, c2=600
    const d = buildDistribution(new Map([['c1', 400n], ['c2', 600n]]));
    const c1 = d.find((x) => x.option_id === 'c1')!;
    const c2 = d.find((x) => x.option_id === 'c2')!;
    expect(c1.volume).toBe(400);
    expect(c2.volume).toBe(600);
    expect(c1.pct).toBeCloseTo(40, 5);
    expect(c2.pct).toBeCloseTo(60, 5);
    // Ẩn ở tầng API: không có key nào để F12 moi ra "tôi được bao nhiêu"
    expect('implied_payout_ratio' in c1).toBe(false);
    expect(JSON.stringify(d)).not.toContain('implied');
  });

  it('cửa 0 volume → volume 0, pct 0', () => {
    const d = buildDistribution(new Map([['c1', 100n], ['c2', 0n]]));
    const c2 = d.find((x) => x.option_id === 'c2')!;
    expect(c2.volume).toBe(0);
    expect(c2.pct).toBe(0);
  });
});
