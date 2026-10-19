/**
 * HÀNG RÀO "ĐANG NỐI VÀO DB NÀO" — bài canh cho chính hai hàng rào đó (D289).
 *
 * ⚠ Ca thật bài này sinh ra để chặn: `npm run migrate --env-file=.env.prod` chạy
 * **trên dev**. npm nuốt cờ lạ, in một dòng warn, rồi chạy tiếp trên `.env`. Ba
 * lệnh đều báo ✔ và cả ba nói về nhầm máy. Không lệnh nào sai; chỉ không lệnh
 * nào NÓI nó đang ở đâu.
 *
 * Nửa sau là bài QUÉT MÃ NGUỒN: một lệnh chạy tay vào DB thật mà quên hàng rào
 * thì đỏ — cùng khuôn ba sổ đăng ký đã có trong repo.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SO_DANG_KY_LENH_THAT, chanEnvFileBiNuot, coVeTuXa, moTaDb,
} from '../scripts/moi_truong.js';

const GOC = process.cwd();

describe('moTaDb — nói ĐỦ để nhận ra máy, KHÔNG nói thông tin đăng nhập', () => {
  it('cắt sạch user/mật khẩu, giữ host + cổng + tên DB', () => {
    const s = moTaDb('postgresql://nguoi:matkhau-rat-bi-mat@db.abc.supabase.co:5432/postgres');
    expect(s).toBe('db.abc.supabase.co:5432/postgres');
    expect(s).not.toContain('matkhau');
    expect(s).not.toContain('nguoi');
  });

  it('dev cục bộ đọc ra đúng chuỗi người ta nhận mặt được', () => {
    expect(moTaDb('postgresql://x:y@127.0.0.1:5544/delphi_dev')).toBe('127.0.0.1:5544/delphi_dev');
  });

  it('thiếu hoặc hỏng ⇒ nói RÕ là thiếu, không trả chuỗi rỗng trông như bình thường', () => {
    expect(moTaDb(undefined)).toMatch(/chưa có DATABASE_URL/);
    expect(moTaDb('')).toMatch(/chưa có DATABASE_URL/);
    expect(moTaDb('không-phải-url')).toMatch(/không phân tích được/);
  });

  it('coVeTuXa: localhost là cục bộ, tên miền là từ xa, không đọc được thì KHÔNG đoán', () => {
    expect(coVeTuXa('postgresql://x@127.0.0.1:5544/d')).toBe(false);
    expect(coVeTuXa('postgresql://x@localhost:5432/d')).toBe(false);
    expect(coVeTuXa('postgresql://x@db.abc.supabase.co:5432/postgres')).toBe(true);
    expect(coVeTuXa(undefined)).toBe(false);
  });
});

describe('⭐ chanEnvFileBiNuot — bắt đúng cái gõ sai đã xảy ra', () => {
  it('sạch khi không ai truyền gì', () => {
    expect(chanEnvFileBiNuot({}, 'migrate')).toBeNull();
    expect(chanEnvFileBiNuot({ npm_config_env_file: '' }, 'migrate')).toBeNull();
  });

  it('npm nuốt cờ ⇒ trả câu lỗi, KÈM lệnh đúng để gõ lại', () => {
    const s = chanEnvFileBiNuot({ npm_config_env_file: '.env.prod' }, 'nap_quy_cho');
    expect(s).not.toBeNull();
    // Ba thứ một câu lỗi hữu ích phải có: cái sai · hậu quả · lệnh đúng.
    expect(s!).toContain('--env-file=.env.prod');
    expect(s!).toMatch(/npm nuốt|KHÔNG có tác dụng/);
    expect(s!).toContain('npx tsx --env-file=.env.prod scripts/nap_quy_cho.ts');
    expect(s!).toContain(':prod');
  });

  it('⚠ câu lỗi KHÔNG được chứa mật khẩu — nó sẽ bị dán vào chat', () => {
    const s = chanEnvFileBiNuot(
      { npm_config_env_file: '.env.prod', DATABASE_URL: 'postgresql://u:sieu-bi-mat@h:5432/d' },
      'migrate',
    );
    expect(s!).not.toContain('sieu-bi-mat');
  });
});

describe('⭐ QUÉT MÃ NGUỒN — lệnh chạy tay vào DB thật phải có ĐỦ HAI hàng rào', () => {
  it('sổ đăng ký không rỗng và mỗi dòng tự bào chữa được', () => {
    // Không có ngưỡng này thì một sổ bị xoá sạch vẫn làm mọi bài dưới xanh.
    expect(SO_DANG_KY_LENH_THAT.length).toBeGreaterThanOrEqual(5);
    for (const x of SO_DANG_KY_LENH_THAT) {
      expect(x.viSao.length, `${x.tep} thiếu lý do`).toBeGreaterThan(20);
    }
  });

  it.each(SO_DANG_KY_LENH_THAT.map((x) => [x.tep] as const))(
    '%s gọi cả `chanEnvFileBiNuot` lẫn `inDb`', (tep) => {
      const nguon = readFileSync(join(GOC, tep), 'utf8');
      expect(nguon, `${tep} chưa chặn cờ npm nuốt`).toMatch(/chanEnvFileBiNuot\s*\(/);
      expect(nguon, `${tep} chưa in ra DB đang nối`).toMatch(/inDb\s*\(/);
    },
  );
});
