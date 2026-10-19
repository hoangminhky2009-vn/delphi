/**
 * VÒNG BỊ ĐÁM ĐÔNG SỬA ĐỀ BÀI — cờ chất lượng dữ liệu (D206).
 *
 * Hai máy thay ô (phản thân D4 đếm GHẾ · bẻ-chuỗi D160 đếm VỐN) đổi mặt ô sắp
 * lật khi bàn dồn. Vòng đó người chơi vẫn quyết như thường, nhưng ĐỀ BÀI đã bị
 * chính đám đông sửa. Trước bản này sổ thay ô không rời khỏi engine.
 *
 *   §I   DÂY — cờ đi trọn đường replay → kho → hồ sơ.
 *   §II  ⭐⭐ KHAI RA, KHÔNG LỌC — mùa này n nhỏ, lọc là còn 0 mẫu.
 *   §III ⚠ KHÔNG PHẢI CỬA MỘT CHIỀU — trận cũ dựng lại được (phái sinh D106).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dungHoSo, type VongInsight } from '../server/holdem/insight.js';

const vong = (them: Partial<VongInsight> = {}): VongInsight => ({
  match_id: 'm', lenh: [], pnl_bp: 0, brier: null, brier_v: null,
  mo_bang: false, o_su_kien: false, la_tin_gia: false, chuoi_tang: false,
  tu_dong: false, cho_bp: null, tien_mat_bp: null, so_ma: null,
  ...them,
} as unknown as VongInsight);

describe('I. Dây — cờ đi trọn đường', () => {
  const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('⭐ replay ĐỌC sổ thay ô của chính vòng vừa chốt, không dựng nguồn thứ hai', () => {
    const api = doc('server/holdem_api.ts');
    const khoi = api.slice(api.indexOf('kvVong.push({') - 1500, api.indexOf('kvVong.push({') + 400);
    // D302 — ba người đọc (sổ hành vi · DTO vòng `o_doi` · ô lịch sử `doi`) đi qua MỘT hàm
    // `oDoiCua` của engine; hàm đó mới là chỗ đọc hai sổ. Canh cả hai tầng: chỗ gọi và chỗ đọc —
    // bản trước canh `st.phan_than` ngay trong khối này, tức là canh một bản cài đặt riêng
    // (đúng thứ D61 cấm) chứ không canh "một nguồn".
    expect(khoi, 'sổ hành vi phải hỏi `oDoiCua(st, vongDo)`').toMatch(/oDoiCua\(st, vongDo\)/);
    expect(khoi, 'cờ không được đẩy vào dòng khẩu vị').toContain('thay_o_do');
    const eng = doc('server/holdem/engine.ts');
    const j = eng.indexOf('export function oDoiCua');
    expect(j, 'engine phải có oDoiCua').toBeGreaterThan(0);
    const than = eng.slice(j, j + 600);
    expect(than, 'không đọc `st.phan_than`').toContain('st.phan_than');
    expect(than, 'không đọc `st.be_chuoi`').toContain('st.be_chuoi');
  });

  it('⭐ kho GHI cột và migration có khai', () => {
    const kho = doc('server/hanh_vi/kho.ts');
    expect(kho, 'INSERT thiếu cột ⇒ kho không cắt được vòng sạch/bẩn')
      .toMatch(/so_o, vai, thay_o_do,/);
    const mig = doc('migrations/0050_hanh_vi_thay_o.sql');
    expect(mig).toContain('ADD COLUMN IF NOT EXISTS thay_o_do');
  });

  it('⚠ hai sổ không bao giờ cùng ghi MỘT vòng — bẻ-chuỗi tự nhường phản thân', () => {
    const eng = doc('server/holdem/engine.ts');
    const i = eng.indexOf('export function apBeChuoiVon');
    expect(eng.slice(i, i + 900), 'mất cú nhường ⇒ một lực bị đếm hai lần')
      .toMatch(/st\.phan_than\?\.some/);
  });
});

describe('II. ⭐⭐ Khai ra, không lọc', () => {
  it('⭐⭐ hồ sơ ĐẾM vòng bị thay ô', () => {
    const hs = dungHoSo([
      vong(), vong({ thay_o_do: 'phan_than' }), vong({ thay_o_do: 'be_chuoi' }), vong(),
    ], 1);
    expect(hs.n_vong_thay_o).toBe(2);
    expect(hs.n_vong, 'vòng bị thay vẫn ở TRONG mẫu — khai ra chứ không lọc').toBe(4);
  });

  it('không có vòng nào bị thay ⇒ 0, và mẫu không đổi', () => {
    const hs = dungHoSo([vong(), vong(), vong()], 1);
    expect(hs.n_vong_thay_o).toBe(0);
    expect(hs.n_vong).toBe(3);
  });

  it('dòng CŨ (vắng trường) không rơi khỏi mẫu, chỉ không được đếm là bẩn', () => {
    const hs = dungHoSo([vong({ thay_o_do: null }), vong()], 1);
    expect(hs.n_vong_thay_o).toBe(0);
    expect(hs.n_vong).toBe(2);
  });

  it('⚠ server không trả chữ tiếng Việt (luật 2 của insight.ts)', () => {
    const hs = dungHoSo([vong({ thay_o_do: 'phan_than' })], 1);
    expect(JSON.stringify(hs.n_vong_thay_o)).not.toMatch(/[àáâãèéêìíòóôõùúăđĩũơư]/i);
  });
});

describe('III. ⚠ Không phải cửa một chiều', () => {
  it('⭐⭐ cờ nằm ở bảng PHÁI SINH, dựng lại được — không cần vào `events`', () => {
    const mig43 = readFileSync(
      resolve(process.cwd(), 'migrations/0043_hanh_vi.sql'), 'utf8');
    expect(mig43, 'hanh_vi_vong thôi là bảng phái sinh ⇒ cờ này thành cửa một chiều')
      .toMatch(/PHÁI SINH từ events/);
    const mig47 = readFileSync(
      resolve(process.cwd(), 'migrations/0050_hanh_vi_thay_o.sql'), 'utf8');
    expect(mig47, 'migration phải nói rõ vì sao KHÔNG đưa vào events')
      .toMatch(/append-only|CỬA MỘT CHIỀU/);
  });
});
