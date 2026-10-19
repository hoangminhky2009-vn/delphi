/**
 * PFM — MỘT CỬA cho câu "đây có phải một cú TIÊU không" (D420) · và "đây có phải TIỀN VÀO không" (D421).
 *
 * Khoản PHÂN BỔ (chuyển ví → hũ ở màn HŨ, kể cả quy tắc tự chia mỗi ngày) là `chi` + dấu `phanBo`. Nó RỜI ví nhưng
 * không phải tiêu. Một chỗ nào quên điều ấy thì một quy tắc 50k/ngày thổi "đã chi" thêm 1,5 triệu mỗi tháng, làm GƯƠNG
 * nói người dùng tiêu đều như máy, làm Oracle đổi "món lớn" sang đơn vị sai, và làm bộ dò khoản lặp mời "lưu mẫu" cho
 * chính quy tắc ấy — rồi đặc trưng nghiên cứu rời máy mang theo cả mớ.
 * §I canh MÃ NGUỒN (mẫu `chieu === 'chi'` trần ngoài `so.ts`) · §II canh HÀNH VI từng nơi tính chi tiêu.
 * D421 — RÚT ở màn HŨ (hũ → ví) là `thu` + dấu `phanBo`. Nó VỀ ví nhưng không phải tiền về: một chỗ quên điều ấy thì cú rút
 * 500k thành "một đợt lương" — luật "tiền vừa về" bắn, GƯƠNG đếm thêm một lần tiền về, dòng tiền tháng của danh mục phình,
 * và quy tắc 10 % tiền vào chia lại chính số tiền vừa rút. §III canh mã nguồn (`chieu === 'thu'` trần ở `pfm/`) · §IV
 * canh hành vi.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { congSo, laThu, taoKhoan, type Khoan } from '../src/pfm/so.js';
import { taoKhoanPhanBo, tienConLai } from '../src/pfm/phan_bo.js';
import { dongTienThang } from '../src/pfm/vi_the.js';
import { denHan } from '../src/pfm/tu_dong.js';
import { tuTao } from '../src/pfm/hu.js';
import { chiTheoNgay, guongKy } from '../src/pfm/guong.js';
import { quyDoiMon } from '../src/pfm/quy_doi.js';
import { deNghiMauLap } from '../src/pfm/khoan_lap.js';
import { tienToiNgay } from '../src/pfm/tien_toi_ngay.js';
import { danhGiaDieuKien, taoLuatMoi } from '../src/pfm/luat.js';
import { demKhoanCoNhan, demNgayGhi } from '../src/pfm/lo_trinh.js';

const GOC = resolve(__dirname, '../src');
const QUET = ['pfm', 'screens/tai-chinh', 'components/pfm'];
/**
 * Tệp DUY NHẤT được viết `chieu === 'chi'` trần: nơi định nghĩa `laChiTieu`, `congSo`, và hai phép cộng HŨ (góp là
 * chi — ĐÚNG ra phải đếm khoản phân bổ). Khoá theo ĐƯỜNG DẪN tệp, không theo tên hàm.
 */
const MIEN = new Set(['pfm/so.ts']);
const RX = /chieu\s*[!=]==\s*'chi'/g;

function tep(thuMuc: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(thuMuc)) {
    const p = join(thuMuc, ten);
    if (statSync(p).isDirectory()) ra.push(...tep(p));
    else if (/\.tsx?$/.test(ten)) ra.push(p);
  }
  return ra;
}

describe('§I — ⭐⭐⭐ bài canh mã nguồn', () => {
  it('⭐⭐⭐ ngoài `so.ts`, không tệp nào tự viết `chieu === \'chi\'` — mọi phép tính chi tiêu đi qua `laChiTieu`', () => {
    const vi: string[] = [];
    for (const d of QUET) {
      for (const f of tep(join(GOC, d))) {
        const ten = relative(GOC, f).replace(/\\/g, '/');
        if (MIEN.has(ten)) continue;
        const n = (readFileSync(f, 'utf8').match(RX) ?? []).length;
        if (n > 0) vi.push(`${ten}: ${n}`);
      }
    }
    expect(vi).toEqual([]);
  });

  it('bài canh KHÔNG rỗng: mẫu dò thấy đúng những chỗ hợp lệ trong `so.ts`', () => {
    expect((readFileSync(join(GOC, 'pfm/so.ts'), 'utf8').match(RX) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

/* ── Sổ mẫu: tháng 8–9 tiêu lặt vặt + lương; RỒI thêm quy tắc tự chia 50k MỖI NGÀY suốt hai tháng + một cú nạp tay 1tr. ── */
const NAY = '2026-09-26';
const tieu: Khoan[] = [];
for (const [thang, soNgay] of [['2026-08', 31], ['2026-09', 26]] as const) {
  tieu.push(taoKhoan({ ngay: `${thang}-05`, soTien: 3_000_000, chieu: 'thu' }, `${thang}-05T02:00:00.000Z`, `luong-${thang}`));
  for (let d = 1; d <= soNgay; d++) {
    const ngay = `${thang}-${String(d).padStart(2, '0')}`;
    tieu.push(taoKhoan({ ngay, soTien: 30_000 + (d % 5) * 11_000 }, `${ngay}T05:00:00.000Z`, `chi-${ngay}`));
  }
}
const phanBo: Khoan[] = [];
for (const [thang, soNgay] of [['2026-08', 31], ['2026-09', 26]] as const) {
  for (let d = 1; d <= soNgay; d++) {
    const ngay = `${thang}-${String(d).padStart(2, '0')}`;
    phanBo.push(taoKhoanPhanBo({ ngay, soTien: 50_000, huId: 'h-xe', phanBo: 'tu_dong' }, `${ngay}T14:00:00.000Z`, `td-${ngay}`));
  }
}
phanBo.push(taoKhoanPhanBo({ ngay: NAY, soTien: 1_000_000, huId: 'h-xe', phanBo: 'tay' }, `${NAY}T15:00:00.000Z`, 'tay-1tr'));
// Một ngày tháng 7 CHỈ có khoản phân bổ, không cú ghi nào — để bài "ngày có ghi" có cái mà bắt.
phanBo.push(taoKhoanPhanBo({ ngay: '2026-07-10', soTien: 50_000, huId: 'h-xe', phanBo: 'tu_dong' }, '2026-07-10T14:00:00.000Z', 'td-07'));
const ca = [...tieu, ...phanBo];

describe('§II — ⭐⭐⭐ mọi nơi tính CHI TIÊU cho cùng một kết quả khi thêm khoản phân bổ', () => {
  it('⭐⭐⭐ tổng chi ở SỔ (`congSo`) — "đã chi" không phình', () => {
    expect(congSo(ca)).toEqual(congSo(tieu));
  });

  it('⭐⭐⭐ GƯƠNG một kỳ (`guongKy` — nguồn của đặc trưng nghiên cứu rời máy)', () => {
    expect(guongKy(ca)).toEqual(guongKy(tieu));
  });

  it('⭐⭐ chi theo ngày (nền của "ngày tiêu đậm" và Oracle quy đổi món lớn)', () => {
    expect(chiTheoNgay(ca)).toEqual(chiTheoNgay(tieu));
    expect(quyDoiMon({ soTien: 800_000, so: ca, hu: [] })).toEqual(quyDoiMon({ soTien: 800_000, so: tieu, hu: [] }));
  });

  it('⭐⭐ bộ dò khoản lặp KHÔNG mời "lưu mẫu" cho quy tắc tự chia 50k/ngày', () => {
    const vao = { homNay: NAY, daCoMau: new Set<string>(), daHoi: new Set<string>() };
    expect(deNghiMauLap({ ...vao, so: ca })).toEqual(deNghiMauLap({ ...vao, so: tieu }));
  });

  it('⭐⭐ "từ lần tiền về tới nay đã tiêu" (GIÚP 5)', () => {
    expect(tienToiNgay(ca, NAY)).toEqual(tienToiNgay(tieu, NAY));
  });

  it('⭐⭐ luật "có khoản vượt mức" không bắn vì cú NẠP 1 triệu vào hũ', () => {
    const l = taoLuatMoi({ loiNhac: 'nghĩ lại một nhịp', dieuKien: 'khoan_vuot_muc', thamSo: { nguong: 300_000 } },
      `${NAY}T01:00:00.000Z`, 'l1');
    expect(danhGiaDieuKien(l, ca, NAY)).toEqual(danhGiaDieuKien(l, tieu, NAY));
    expect(danhGiaDieuKien(l, ca, NAY).dung).toBe(false);
  });

  it('⭐⭐ lộ trình: ngày chỉ có khoản phân bổ không là "ngày có ghi"; khoản do QUY TẮC không là việc người dùng làm', () => {
    expect(demNgayGhi(ca)).toBe(demNgayGhi(tieu));
    expect(demKhoanCoNhan(ca), 'chỉ cú nạp TAY được đếm').toBe(demKhoanCoNhan(tieu) + 1);
  });
});

/* ═══ D421 — TIỀN VÀO: một cửa `laThu` ════════════════════════════════════════════════════════════════════ */

/**
 * Tệp được viết `chieu === 'thu'` trần ở `pfm/`: `so.ts` (nơi định nghĩa `laThu`, `congSo`, phép cộng hũ) và `phan_bo.ts`
 * (ví = Σ THU − Σ CHI của MỌI khoản — rút hũ ĐÚNG ra phải về ví; và `laRutHu`). Khoá theo đường dẫn tệp.
 */
const MIEN_THU = new Set(['pfm/so.ts', 'pfm/phan_bo.ts']);
const RX_THU = /chieu\s*[!=]==\s*'thu'/g;

describe('§III — ⭐⭐⭐ bài canh mã nguồn: tiền vào', () => {
  it('⭐⭐⭐ ngoài `so.ts`/`phan_bo.ts`, không tệp nào ở `pfm/` tự viết `chieu === \'thu\'` — tiền vào đi qua `laThu`', () => {
    const vi: string[] = [];
    for (const f of tep(join(GOC, 'pfm'))) {
      const ten = relative(GOC, f).replace(/\\/g, '/');
      if (MIEN_THU.has(ten)) continue;
      const n = (readFileSync(f, 'utf8').match(RX_THU) ?? []).length;
      if (n > 0) vi.push(`${ten}: ${n}`);
    }
    expect(vi).toEqual([]);
  });

  it('bài canh KHÔNG rỗng: mẫu dò thấy những chỗ hợp lệ trong `so.ts` và `phan_bo.ts`', () => {
    expect((readFileSync(join(GOC, 'pfm/so.ts'), 'utf8').match(RX_THU) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((readFileSync(join(GOC, 'pfm/phan_bo.ts'), 'utf8').match(RX_THU) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

/* Sổ §II + ba cú RÚT (hũ → ví) rải trong tháng 9, kể cả ngay hôm nay. */
const rut: Khoan[] = ['2026-09-12', '2026-09-20', NAY].map((ngay, i) => taoKhoanPhanBo(
  { ngay, soTien: 500_000, huId: 'h-xe', phanBo: 'tay', chieu: 'thu' }, `${ngay}T16:00:00.000Z`, `rut-${i}`,
));
const caRut = [...ca, ...rut];

describe('§IV — ⭐⭐⭐ mọi nơi tính TIỀN VÀO cho cùng một kết quả khi thêm cú RÚT', () => {
  it('⭐⭐⭐ cú rút không phải tiền vào (`laThu`), nhưng VỀ ví (ba cú 500k ⇒ ví 1,5 triệu)', () => {
    expect(rut.every((k) => !laThu(k))).toBe(true);
    // ⚠ Đo trên chính ba cú rút: sổ §II tiêu + chia nhiều hơn tiền vào ⇒ ví của nó kẹp ở 0 (P7), cộng thêm không thẳng.
    expect(tienConLai(rut)).toBe(1_500_000);
    expect(tienConLai(caRut)).toBeGreaterThan(tienConLai(ca));
  });

  it('⭐⭐⭐ SỔ (`congSo`) và GƯƠNG (`guongKy` — tiền về · tiêu sau tiền về · tiết kiệm ròng)', () => {
    expect(congSo(caRut)).toEqual(congSo(ca));
    expect(guongKy(caRut)).toEqual(guongKy(ca));
  });

  it('⭐⭐ dòng tiền tháng của DANH MỤC không phình · "từ lần tiền về tới nay" không đặt lại mốc', () => {
    expect(dongTienThang(caRut, '2026-09')).toEqual(dongTienThang(ca, '2026-09'));
    expect(tienToiNgay(caRut, NAY)).toEqual(tienToiNgay(ca, NAY));
  });

  it('⭐⭐ luật "tiền vừa về" KHÔNG bắn vì cú rút hôm nay', () => {
    const l = taoLuatMoi({ loiNhac: 'để dành trước', dieuKien: 'tien_vua_ve' }, `${NAY}T01:00:00.000Z`, 'l2');
    expect(danhGiaDieuKien(l, caRut, NAY)).toEqual(danhGiaDieuKien(l, ca, NAY));
  });

  it('⭐⭐ quy tắc 10 % tiền vào KHÔNG chia lại tiền vừa rút', () => {
    const h = { ...tuTao({ ten: 'Dự phòng' }, '2026-09-01T00:00:00.000Z', 'h-dp'),
      tuDong: { kieu: 'phan_tram' as const, gt: 10, tu: '2026-09-01', chayToi: null, moc: null } };
    expect(denHan([h], caRut, NAY).tienVaoMoi).toBe(denHan([h], ca, NAY).tienVaoMoi);
  });
});
