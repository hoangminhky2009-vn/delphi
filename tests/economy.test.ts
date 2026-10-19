/**
 * Test hằng số kinh tế + applyBp khớp các con số trong CLAUDE.md A4/A5.
 * (Test vectors A5.2 đầy đủ thuộc GĐ3 — đây chỉ kiểm phần số học bp của GĐ1.)
 */
import { describe, it, expect } from 'vitest';
import { ECONOMY, RANK_FORMULA, BP_DENOMINATOR, applyBp } from '../config/economy.js';
import { isLocalDatabaseUrl } from '../scripts/seed_dev.js';

describe('config/economy — khớp A4', () => {
  it('giá trị đúng CLAUDE.md A4', () => {
    expect(ECONOMY.STARTING_BANKROLL).toBe(1_000);
    expect(ECONOMY.RAKE_BURN_BP / BP_DENOMINATOR).toBe(0.03);
    expect(ECONOMY.RAKE_TREASURY_BP / BP_DENOMINATOR).toBe(0.02);
    expect(ECONOMY.BET_CAP_BP / BP_DENOMINATOR).toBe(0.2);
    expect(ECONOMY.MIN_BET).toBe(1);
    expect(ECONOMY.SUBSIDY_THRESHOLD).toBe(500);
    expect(ECONOMY.SUBSIDY_AMOUNT).toBe(50);
    expect(ECONOMY.SUBSIDY_MONTHLY_CAP).toBe(1_000);
    expect(ECONOMY.UNRANKED_THRESHOLD).toBe(5);
    expect(ECONOMY.RESOLUTION_TIMEOUT_DAYS).toBe(7);
    expect(ECONOMY.AGE_GATE_MIN).toBe(16);
    expect(ECONOMY.SEASON_LENGTH_MONTHS).toBe(3);
    expect(RANK_FORMULA.RECENCY_DECAY_BP / BP_DENOMINATOR).toBe(0.9);
  });
});

describe('applyBp — số học nguyên, floor (C5)', () => {
  it('rake trên pool 1.000 (số của Vector 1/2 A5.2): burn 30, treasury 20', () => {
    expect(applyBp(1_000n, ECONOMY.RAKE_BURN_BP)).toBe(30n);
    expect(applyBp(1_000n, ECONOMY.RAKE_TREASURY_BP)).toBe(20n);
  });

  it('cap 20% của 1.000 = 200 (ví dụ A5.3)', () => {
    expect(applyBp(1_000n, ECONOMY.BET_CAP_BP)).toBe(200n);
  });

  it('luôn floor, không làm tròn lên', () => {
    // 3% của 999 = 29,97 → floor 29
    expect(applyBp(999n, ECONOMY.RAKE_BURN_BP)).toBe(29n);
    // 20% của 999 = 199,8 → floor 199
    expect(applyBp(999n, ECONOMY.BET_CAP_BP)).toBe(199n);
    // 3% của 1 = 0,03 → floor 0
    expect(applyBp(1n, ECONOMY.RAKE_BURN_BP)).toBe(0n);
  });

  it('từ chối bp không hợp lệ và amount âm', () => {
    expect(() => applyBp(100n, -1)).toThrow();
    expect(() => applyBp(100n, 10_001)).toThrow();
    expect(() => applyBp(-1n, 300)).toThrow();
  });
});

describe('chốt an toàn seed_dev — chỉ cho phép DB trên máy này', () => {
  it('chấp nhận đúng localhost', () => {
    expect(isLocalDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:5544/delphi_dev')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://postgres:postgres@localhost:5432/x')).toBe(true);
  });

  it('CHẶN mọi host từ xa — kể cả khi .env bị dán nhầm chuỗi prod', () => {
    expect(
      isLocalDatabaseUrl(
        'postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe(false);
    expect(isLocalDatabaseUrl('postgresql://u:p@db.abc.supabase.co:5432/postgres')).toBe(false);
    expect(isLocalDatabaseUrl('postgresql://u:p@127.0.0.1.evil.com:5432/x')).toBe(false);
    expect(isLocalDatabaseUrl('')).toBe(false);
    expect(isLocalDatabaseUrl('khong-phai-url')).toBe(false);
  });
});
