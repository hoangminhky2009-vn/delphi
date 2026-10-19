/**
 * D447 — BỎ NÚT KHỚP NGAY · NGÂN HÀNG GỬI TRÊN TIỀN MẶT SAU LỆNH (founder 28/09).
 *
 * Founder chọn phí mua bán CỘNG DỒN CẢ VÒNG (v56), rồi hỏi: *"khớp ngay giờ có bị thừa thãi ko với cơ chế mới?"* ⇒ bỏ.
 * Lúc CHỐT server đã tự chạy huỷ tiết kiệm → lệnh (bán trước, mua sau) → gửi tiết kiệm trên tiền còn lại; chip MUA đã tính
 * trên tiền sau lệnh bán đang xếp; ô vòng này vẫn úp. Chỗ DUY NHẤT còn dựa vào nút là ngăn ngân hàng — nó tính trên tiền
 * mặt HIỆN CÓ, ví 0 là khoá gửi. Bài này khoá:
 *   §I   `tienMatSauLenhDangXep` — số ngân hàng đọc = đúng tiền mặt engine để lại sau chuỗi (ghế founder chụp: VÍ 0 → …);
 *   §II  ngăn NGÂN HÀNG gửi được trên số ấy, và nói rõ đó là tiền SAU lệnh;
 *   §III cả LỚP: web/src không còn đường nào gọi khớp giữa vòng; màn trận trải thẳng số sau lệnh vào ngân hàng.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HOLDEM_BALANCE_VERSION } from '@config/holdem';
import { luatCua } from '@config/holdem_balance';
import { apLenhMocNav, taoTran, tuyChonLenhGhe, type TrangThaiTran } from '@server/holdem/engine';
import { tienTuMoc, type LenhMoc } from '@server/holdem/nav';

vi.mock('@/lib/telemetry', () => ({ ghiDo: () => {} }));

import { NganHang } from '../src/components/holdem/NganHang';
import { tienMatSauLenhDangXep } from '../src/lib/xemTruocLenh';

/** Ghế cầm hết vốn bằng USDT, tiền mặt 0 — đúng màn founder chụp 28/09 (VÍ 0 → 17.206 · NAV 18.472). */
function gheUsdt(): { st: TrangThaiTran; ban: Parameters<typeof tienMatSauLenhDangXep>[0] } {
  const st0 = taoTran(4471, [
    { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', vai: 'ca_nhan', danh_muc: { tai_san: [], chien_thuat: [] } },
  ], luatCua(HOLDEM_BALANCE_VERSION), 16);
  const g = { ...st0.ghe[0]!, von: 0, vi_the: { usd: 18_472 }, danh_muc: { tai_san: ['usd'], chien_thuat: [] } };
  const st = { ...st0, vong: 5, phi_giao_dich_vong: 0, ghe: [g] };
  // Đúng hình dạng DTO: bộ tham số đi qua JSON như qua mạng.
  const tc = JSON.parse(JSON.stringify(tuyChonLenhGhe(st, g)));
  return { st, ban: { von: 0, tien_mat: 0, vi_the: { usd: 18_472 }, vi_the_khong: {}, tuy_chon_lenh: tc } };
}
const RUT_HET: LenhMoc[] = [{ ma: 'usd', chieu: 'ban', moc_bp: 10000 }];

describe('§I — tiền mặt sau lệnh đang xếp = đúng số engine để lại', () => {
  it('⭐ ví 0, xếp RÚT USDT HẾT ⇒ số ngân hàng đọc = tiền mặt engine trả sau chuỗi (không phải 0)', () => {
    const { st, ban } = gheUsdt();
    const sau = tienMatSauLenhDangXep(ban, RUT_HET, null);
    const that = apLenhMocNav(st, 'ban', RUT_HET);
    expect(that.ok).toBe(true);
    expect(sau, 'ngân hàng vẫn đọc tiền mặt hiện có').not.toBeNull();
    expect(sau).toBe(that.st.ghe[0]!.von);
    expect(sau!).toBeGreaterThan(17_000);
  });

  it('không lệnh ⇒ null (ngân hàng đọc tiền mặt hiện có) · server chưa phát bộ tham số ⇒ null · chuỗi sẽ bị bác ⇒ null', () => {
    const { ban } = gheUsdt();
    expect(tienMatSauLenhDangXep(ban, [], null)).toBeNull();
    const { tuy_chon_lenh: _bo, ...khongBo } = ban;
    expect(tienMatSauLenhDangXep(khongBo, RUT_HET, null)).toBeNull();
    // mua khi ví 0 và không bán gì ⇒ giải ra 0 đồng / bác ⇒ không có số sau lệnh
    expect(tienMatSauLenhDangXep(ban, [{ ma: 'usd', chieu: 'khong', moc_bp: 10000 }], null)).toBeNull();
  });
});

describe('§II — ngăn NGÂN HÀNG gửi trên tiền mặt sau lệnh', () => {
  const dung = (tienMat: number, sauLenh?: boolean) => render(
    <NganHang
      tienMat={tienMat} {...(sauLenh ? { sauLenh } : {})}
      hopDong={[]} baoGia={[{ so_vong: 3, lai_bp: 120 }] as never} guiDuoc gocToiThieu={500} buocMocBp={500}
      chonMo={{ moc_bp: 5000, so_vong: 3 }} chonHuy={[]} onChonMo={() => {}} onChonHuy={() => {}}
    />,
  );

  it('⭐ số sau lệnh ⇒ nhãn nói rõ "tiền mặt sau lệnh" và gốc gửi tính trên số ấy, không bị chặn "gốc tối thiểu"', () => {
    dung(17_206, true);
    expect(screen.getByText(/tiền mặt sau lệnh/)).toBeTruthy();
    expect(document.body.textContent).toContain((17_206).toLocaleString('vi-VN'));
    // Mốc đang hiện ("25% → 4.300") — gốc phải là mốc ấy của 17.206, không phải của ví 0.
    const m = /(\d+)% → ([\d.]+)/.exec(document.body.textContent ?? '');
    expect(m, 'ngăn không in mốc gửi').not.toBeNull();
    expect(Number(m![2]!.replace(/\./g, ''))).toBe(tienTuMoc(Number(m![1]) * 100, 17_206));
    expect(Number(m![2]!.replace(/\./g, ''))).toBeGreaterThan(0);
    expect(screen.queryByText(/Gốc tối thiểu/)).toBeNull();
  });

  it('vế ngược: ví 0 thật (không lệnh) ⇒ nhãn "tiền mặt", gốc 0 bị chặn đúng như cũ', () => {
    dung(0);
    expect(screen.queryByText(/tiền mặt sau lệnh/)).toBeNull();
    expect(screen.getByText(/Gốc tối thiểu/)).toBeTruthy();
  });
});

/** Bóc chú thích trước khi quét (tiền lệ D87) — lời giải thích vì sao bỏ nút có nhắc tên nó. */
const bocChuThich = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
function tepDuoi(thu: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(thu)) {
    const p = join(thu, ten);
    if (statSync(p).isDirectory()) ra.push(...tepDuoi(p));
    else if (/\.(ts|tsx)$/.test(ten)) ra.push(p);
  }
  return ra;
}

describe('§III — cả lớp: không còn đường khớp giữa vòng ở web', () => {
  it('⭐ không tệp nào trong web/src gọi `/khop-lenh`, dựng nút KHỚP NGAY hay truyền `onKhopNgay`', () => {
    const con = tepDuoi(resolve(process.cwd(), 'src'))
      .filter((p) => /khop-lenh|onKhopNgay|useKhopLenh|['"`]KHỚP NGAY/.test(bocChuThich(readFileSync(p, 'utf8'))));
    expect(con, `còn đường khớp giữa vòng ở: ${con.join(', ')}`).toEqual([]);
  });

  it('màn trận trải thẳng số sau lệnh vào ngân hàng (không bọc điều kiện)', () => {
    const man = bocChuThich(readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8'))
      .replace(/\r\n/g, '\n');
    expect(man).toMatch(/const tienMatSauLenh = tienMatSauLenhDangXep\(b, lenhNhap, chonCT\);/);
    const khoi = /<NganHang\b([\s\S]*?)\/>/.exec(man)?.[1] ?? '';
    expect(khoi, 'không thấy <NganHang> ở màn trận').not.toBe('');
    expect(khoi).toMatch(/tienMat=\{tienMatSauLenh \?\? st\.ban\.tien_mat\}/);
    expect(khoi).toMatch(/sauLenh=\{tienMatSauLenh !== null\}/);
  });
});
