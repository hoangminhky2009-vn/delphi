/**
 * D474 — CHỮ CỦA KHUNG MINIGAME (khoá v57): lõi chép NGUYÊN VĂN demo đã chốt (A11.25); trait chỉ đổi khi trận mang cờ, trận khác byte-hệt.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LOI_MINIGAME_CHU, KhungMinigameCtx } from '@/lib/khung_minigame';
import { chuTrait, TRAIT_CHU, TRAIT_CHU_MINIGAME } from '@/lib/trait_chu';
import { TheTrait } from '@/components/holdem/TheTrait';

const DEMO = readFileSync(resolve(process.cwd(), '../docs/ui-ux/demo/minigame-bat-day.html'), 'utf8');

describe('D474 — chữ lõi chép từ demo', () => {
  it('⭐ năm lá của hằng `LA` trong demo: icon · tên · câu · dòng đo trùng từng ký tự', () => {
    const khoi = DEMO.slice(DEMO.indexOf('const LA = {'), DEMO.indexOf('};', DEMO.indexOf('const LA = {')));
    const la = [...khoi.matchAll(/^\s*(\w+):\s*\{ icon: '([^']+)', ten: '([^']+)',\s*mt: '([^']+)', day: '([^']+)' \}/gm)];
    expect(la.length, 'đọc được năm lá của demo').toBe(5);
    for (const [, id, icon, ten, mt, day] of la) {
      expect(LOI_MINIGAME_CHU[id as keyof typeof LOI_MINIGAME_CHU], id).toEqual({ icon, ten, mt, day });
    }
    expect(Object.keys(LOI_MINIGAME_CHU).sort()).toEqual(la.map((m) => m[1]).sort());
  });
});

describe('D474 — trait đổi nghĩa trong khung', () => {
  it('⭐ KHẨU VỊ ĐA DẠNG (`tam_rong`): câu mới nói đúng số của code — 3 lõi thay vì 2, lượt vòng 6, thêm 1 mã', () => {
    const c = chuTrait('tam_rong', true);
    expect(c.ten).toBe('KHẨU VỊ ĐA DẠNG');
    expect(c.luat).toBe('Giữ được 3 lõi thay vì 2, có thêm lượt chọn lõi ở vòng 6, và giữ thêm 1 mã cùng lúc.');
    // Vế ngược: ngoài khung là câu cũ, nguyên vẹn.
    expect(chuTrait('tam_rong')).toBe(TRAIT_CHU.tam_rong);
    expect(chuTrait('tam_rong', false).ten).toBe('TẦM RỘNG');
  });

  it('lá chưa đổi nghĩa trong engine giữ câu cũ ngay trong khung (không hứa luật chưa chạy)', () => {
    // D486 — KIÊN NHẪN · NÓNG VỘI đã chạy trong màn (`cuaSoTrait`) ⇒ có câu khung minigame; câu khớp đúng số config.
    expect(Object.keys(TRAIT_CHU_MINIGAME)).toEqual(['tam_rong', 'kien_nhan', 'nong_voi']);
    expect(chuTrait('kien_nhan', true).luat).toContain('khoá 10 giây đầu');
    expect(chuTrait('nong_voi', true).luat).toContain('17 giây đầu');
    for (const id of ['noi_gian', 'mu_lua'] as const) expect(chuTrait(id, true)).toBe(TRAIT_CHU[id]);
  });

  it('⭐ thẻ trait đọc cờ trận qua context: có cờ ⇒ tên mới, không cờ ⇒ tên cũ', () => {
    const { unmount } = render(<KhungMinigameCtx.Provider value><TheTrait id="tam_rong" onMo={() => {}} /></KhungMinigameCtx.Provider>);
    expect(screen.getByRole('button').textContent).toContain('KHẨU VỊ ĐA DẠNG');
    unmount();
    render(<TheTrait id="tam_rong" onMo={() => {}} />);
    expect(screen.getByRole('button').textContent).toContain('TẦM RỘNG');
  });
});
