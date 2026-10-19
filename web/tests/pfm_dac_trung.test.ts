/**
 * PFM — ĐẶC TRƯNG (nhóm J). D200.
 *
 *   §I   RIÊNG TƯ — gói KHÔNG chở tiền, không chở chữ tự do (P2 🔒, cửa một chiều).
 *   §II  KHÔNG TÍNH LẠI — mọi số phải TRÙNG KHÍT `guong/` (D61).
 *   §III RANH VỚI SERVER — client chỉ phát thứ chỉ client biết.
 *   §IV  CHƯA ĐỦ MẪU ⇒ VẮNG MẶT, không phải 0 (P7).
 *   §V   NHÃN HŨ theo từng đối tượng + kết cục.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  dongGoiKy, soiGoi, lamTron3, huongSuaMuc, demTamDung, ketCuc,
  MA_CUA_SERVER, LoiDacTrung, type GoiDacTrung,
} from '../src/pfm/dac_trung.js';
import { guongKy } from '../src/pfm/guong.js';
import { taoKhoan, type Khoan, type DauVaoKhoan } from '../src/pfm/so.js';
import { tuTao, sua, doiTrangThai, quyetToan, resetGop, type Hu } from '../src/pfm/hu.js';
import { SCHEMA_VERSION, SO_DANG_KY, type MaDacTrung } from '@config/pfm_dac_trung';

const LUC = '2026-08-31T10:00:00.000Z';
let dem = 0;
const chi = (d: number, nghin: number, v: Partial<DauVaoKhoan> = {}): Khoan =>
  taoKhoan({ ngay: `2026-08-${String(d).padStart(2, '0')}`, soTien: nghin * 1000, ...v },
    LUC, `k${dem++}`);
const thu = (d: number, nghin: number): Khoan => chi(d, nghin, { chieu: 'thu' });

/** Một kỳ đủ dày để mọi chỉ số của gương đều nói được. */
const SO_DAY: Khoan[] = [
  thu(1, 8_000),
  chi(1, 100), chi(2, 400), chi(3, 100), chi(4, 50), chi(5, 400),
  chi(6, 300), chi(7, 100), chi(8, 400), chi(9, 20), chi(10, 100),
  chi(11, 80, { viSale: true }), chi(12, 60, { viSale: false }),
  chi(13, 40, { viSale: true, cachGhi: 'dan_sms' }),
];

const hu = (v: Parameters<typeof tuTao>[0], id: string): Hu => tuTao(v, LUC, id);

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — RIÊNG TƯ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — gói không chở tiền, không chở chữ (P2 🔒 · cửa một chiều)', () => {
  it('⭐⭐ tên hũ, ghi chú và MỌI số tiền đều không có trong gói', () => {
    /*
     * Cửa một chiều: thứ đã đổ lên server thì đã đổ. Sổ có "Đám cưới con Hường 25 triệu"
     * và một khoản 400.000đ; gói chỉ được chở nhãn từ miền đóng, tỷ lệ và đếm.
     */
    const goi = dongGoiKy({
      ky: '2026-08',
      so: SO_DAY,
      hu: [hu({ ten: 'Đám cưới con Hường', ghiChu: 'bí mật', muc: 25_000_000,
        loai: 'su_kien', han: 'vua', uuTien: 'cao' }, 'h1')],
    });
    const s = JSON.stringify(goi);
    expect(s).not.toContain('Hường');
    expect(s).not.toContain('bí mật');
    expect(s).not.toContain('25000000');
    expect(s).not.toContain('400000');
    expect(s).not.toContain('8000000');
  });

  it('⭐ mọi giá trị là nhãn miền-đóng / tỷ lệ / đếm — không giá trị nào là TIỀN', () => {
    /*
     * Phép thử theo HÌNH DẠNG: một tỷ lệ nằm trong [-1,1], một đếm thì nhỏ. Không con số
     * nào của gói được phép có cỡ của một khoản tiền Việt.
     * ⚠ Phải có HŨ trong đầu vào, nếu không nhánh `dem` (`hv_tam_dung_hu`) không bao giờ
     * chạy và một nửa bài này là phép rỗng — bản đầu của tôi đúng như thế.
     */
    const h = doiTrangThai(hu({ ten: 'A', muc: 9_000_000, loai: 'du_lich' }, 'h1'),
      'tam_dung', LUC);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [h] });
    const kieuDaGap = new Set<string>();
    for (const d of goi.dong) {
      const dn = SO_DANG_KY[d.ma];
      kieuDaGap.add(dn.kieu);
      if (dn.kieu === 'ty_le') {
        expect(Math.abs(d.giaTri as number), `${d.ma} có cỡ của một số tiền`)
          .toBeLessThanOrEqual(1);
      }
      if (dn.kieu === 'dem') expect(d.giaTri as number).toBeLessThanOrEqual(dn.max);
      if (dn.kieu === 'nhan') {
        expect(dn.mien as readonly string[], `${d.ma} phát nhãn ngoài miền`)
          .toContain(d.giaTri as string);
      }
    }
    expect([...kieuDaGap].sort(), 'bài phải chạm được cả bốn kiểu, không bỏ nhánh nào')
      .toEqual(['dem', 'nhan', 'phan_bo', 'ty_le']);
  });

  it('⭐⭐ mốc RESET (`Hu.mocGop`) không có trong gói — một mốc mili-giây là dấu vân tay', () => {
    /*
     * Trường mới trên `Hu` (phương án A, D292). Gói đi qua `nhanNguNghia()` nên mặc định nó
     * ở lại — nhưng "mặc định" chỉ là lời hứa cho tới khi có bài chứng minh cho ĐÚNG trường
     * này, ở ĐÚNG cửa ra khỏi máy.
     */
    const moc = '2026-08-20T07:08:09.123Z';
    const h = resetGop(hu({ ten: 'Đã reset', muc: 5_000_000, loai: 'du_phong' }, 'h1'), moc);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [h] });
    const s = JSON.stringify(goi);
    expect(s).not.toContain(moc);
    expect(s).not.toContain('07:08:09');
    expect(s.toLowerCase()).not.toContain('moc');
    expect(goi.dong.some((d) => d.ma === 'y_loai'), 'nhãn thì vẫn đi — chỉ mốc ở lại').toBe(true);
  });

  it('⭐ làm tròn 3 chữ số — bớt độ chính xác là bớt bề mặt vân tay', () => {
    // Một tỷ lệ 17 chữ số thập phân gần như định danh được một người trong nhóm, mà cả
    // kiến trúc cohort dựng ra để điều đó không xảy ra.
    expect(lamTron3(2 / 3)).toBe(0.667);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [] });
    for (const d of goi.dong) {
      if (typeof d.giaTri !== 'number') continue;
      expect(String(d.giaTri).split('.')[1]?.length ?? 0,
        `${d.ma} chở quá 3 chữ số thập phân`).toBeLessThanOrEqual(3);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — KHÔNG TÍNH LẠI
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — đóng gói, KHÔNG tính lại (D61)', () => {
  it('⭐⭐ mọi số hành vi TRÙNG KHÍT `guong/`, tới từng chữ số sau làm tròn', () => {
    /*
     * Hai nơi cùng tính một công thức là bản sao sẽ trôi, và cú trôi ở đây biểu hiện là
     * "màn hình gương nói 42%, hồ sơ cohort nói 38%" cho cùng một tháng — không ai biết
     * bên nào đúng, mà bên sai thì đã nằm trong dataset bán được.
     */
    const g = guongKy(SO_DAY);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [] });
    const lay = (ma: MaDacTrung) => goi.dong.find((d) => d.ma === ma)?.giaTri;
    expect(lay('hv_chi_bu')).toBe(lamTron3(g.chi_bu.gt!));
    expect(lay('hv_tien_ve_tieu')).toBe(lamTron3(g.tien_ve_tieu.gt!));
    expect(lay('hv_tiet_kiem_rong')).toBe(lamTron3(g.tiet_kiem_rong.gt!));
    expect(lay('hv_vi_sale')).toBe(lamTron3(g.vi_sale.gt!));
  });

  it('mã nguồn KHÔNG tự cộng tiền — mọi con số đến từ `guong/` hoặc `hu`', () => {
    const nguon = fs.readFileSync(
      path.resolve(__dirname, '../src/pfm/dac_trung.ts'), 'utf8');
    const ma = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(ma).toContain('guongKy(');
    expect(ma).not.toContain('.soTien');   // đụng tới soTien là đã đi tính lại
    expect(ma).not.toContain('fetch(');
  });

  it('trục so-với-kỳ-trước chỉ xuất hiện khi CÓ kỳ trước', () => {
    const khong = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [] });
    expect(khong.dong.some((d) => d.ma === 'hv_so_voi_ky_truoc')).toBe(false);
    const co = dongGoiKy({ ky: '2026-08', so: SO_DAY, soKyTruoc: [chi(1, 1_000)], hu: [] });
    expect(co.dong.some((d) => d.ma === 'hv_so_voi_ky_truoc')).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — RANH VỚI SERVER
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — client chỉ phát thứ CHỈ CLIENT BIẾT', () => {
  it('⭐ không bao giờ phát mã đếm-ngày (server đã cầm `pfm_ngay` trong tay)', () => {
    /*
     * Gửi một con số server có thể tự đếm là mời một cú lệch không có trọng tài: ngày hai
     * bên ra khác nhau thì tin ai? Server đếm cái server giữ; client phát cái suy từ sổ
     * thô — thứ server không bao giờ thấy.
     */
    const goi = dongGoiKy({
      ky: '2026-08', so: SO_DAY,
      hu: [hu({ ten: 'A', loai: 'du_phong' }, 'h1')],
    });
    for (const cam of MA_CUA_SERVER) {
      expect(goi.dong.some((d) => d.ma === cam), `phát nhầm mã của server: ${cam}`)
        .toBe(false);
    }
  });

  it('`soiGoi` BẮT một gói có mã của server (không chỉ tin đường sinh)', () => {
    const goi: GoiDacTrung = {
      ky: '2026-08', schemaVersion: SCHEMA_VERSION,
      dong: [{ ma: 'hv_ngay_co_mat' as MaDacTrung, giaTri: 20 }],
    };
    expect(soiGoi(goi).join(' ')).toContain('của SERVER');
  });

  it('`soiGoi` BẮT mã lạ và giá trị ngoài miền', () => {
    const goi: GoiDacTrung = {
      ky: '2026-08', schemaVersion: SCHEMA_VERSION,
      dong: [
        { ma: 'hv_bia_dat' as MaDacTrung, giaTri: 1 },
        { ma: 'hv_chi_bu', giaTri: 5 },
      ],
    };
    const loi = soiGoi(goi);
    expect(loi.some((x) => x.includes('Mã lạ'))).toBe(true);
    expect(loi.some((x) => x.includes('hv_chi_bu'))).toBe(true);
  });

  it('⭐ gói dựng bằng DANH MỤC CŨ bị chặn — không gửi im lặng', () => {
    // Một gói có thể nằm trong hàng đợi qua vài phiên bản app; `SCHEMA_VERSION` đổi thì
    // miền đổi theo, và gửi gói cũ là làm bẩn dataset bằng thứ trông vẫn hợp lệ.
    const goi: GoiDacTrung = {
      ky: '2026-08', schemaVersion: SCHEMA_VERSION - 1,
      dong: [{ ma: 'hv_chi_bu', giaTri: 0.25 }],
    };
    expect(soiGoi(goi)[0]).toContain('danh mục');
  });

  it('gói do chính máy dựng thì luôn sạch', () => {
    const goi = dongGoiKy({
      ky: '2026-08', so: SO_DAY, soKyTruoc: [chi(1, 900)],
      hu: [hu({ ten: 'A', loai: 'du_lich', han: 'dai', uuTien: 'thap' }, 'h1')],
    });
    expect(soiGoi(goi)).toEqual([]);
    expect(goi.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('giá trị ngoài miền bị chặn NGAY LÚC ĐÓNG GÓI, không đợi tới cửa server', () => {
    // Chặn ở đây thì lỗi có địa chỉ; chặn ở server thì nó nổ sau khi đã tính cả kỳ.
    expect(() => dongGoiKy({
      ky: '2026-08', so: SO_DAY,
      hu: [{ ...hu({ ten: 'A' }, 'h1'), loai: 'bia_dat' as never }],
    })).toThrow(LoiDacTrung);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — CHƯA ĐỦ MẪU ⇒ VẮNG MẶT
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — chưa đủ mẫu thì VẮNG MẶT, không phải 0 (P7)', () => {
  it('⭐⭐ kỳ rỗng ⇒ KHÔNG một dòng hành vi nào, chứ không phải một loạt số 0', () => {
    /*
     * Một kỳ thiếu dữ liệu mà gửi 0 sẽ được đọc như một kỳ ĐO ĐƯỢC kết quả bằng 0, và nó
     * kéo mọi trung bình cohort xuống mà không ai thấy. Đây là loại lỗi không sửa được
     * sau: dòng đã vào `pfm_dac_trung` thì không phân biệt được nữa.
     */
    const goi = dongGoiKy({ ky: '2026-08', so: [], hu: [] });
    expect(goi.dong).toEqual([]);
  });

  it('kỳ mỏng: chỉ số nào nói được thì phát, chỉ số nào chưa thì VẮNG', () => {
    // Có thu + có chi ⇒ tiết kiệm ròng nói được. Nhưng 2 ngày chi thì chi-bù chưa.
    const goi = dongGoiKy({ ky: '2026-08', so: [thu(1, 900), chi(1, 100), chi(2, 50)], hu: [] });
    const co = (m: string) => goi.dong.some((d) => d.ma === m);
    expect(co('hv_tiet_kiem_rong')).toBe(true);
    expect(co('hv_chi_bu'), 'chưa đủ ngày ⇒ không phát').toBe(false);
    expect(co('hv_vi_sale'), 'chưa hỏi ai ⇒ không phát').toBe(false);
  });

  it('kỳ trước rỗng ⇒ trục so sánh vắng mặt, không phát 0', () => {
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, soKyTruoc: [], hu: [] });
    expect(goi.dong.some((d) => d.ma === 'hv_so_voi_ky_truoc')).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — NHÃN HŨ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§V — nhãn hũ theo từng đối tượng', () => {
  it('⭐ phát THEO TỪNG HŨ, không gộp — Intent phải nối được với Outcome', () => {
    /*
     * Câu hỏi nghiên cứu là "nhóm có mục tiêu giáo dục hoàn thành cao hơn nhóm du lịch
     * không". Gộp nhãn trước khi gửi là tự tay xoá đúng phép nối Intent → Outcome mà cả
     * sổ đăng ký dựng ra để phục vụ.
     */
    const goi = dongGoiKy({
      ky: '2026-08', so: [],
      hu: [
        hu({ ten: 'Học tiếng Anh', loai: 'giao_duc', han: 'dai' }, 'h1'),
        hu({ ten: 'Đi Đà Lạt', loai: 'du_lich', han: 'ngan' }, 'h2'),
      ],
    });
    const loai = goi.dong.filter((d) => d.ma === 'y_loai');
    expect(loai).toHaveLength(2);
    expect(loai.map((d) => [d.doiTuong, d.giaTri]))
      .toEqual([['h1', 'giao_duc'], ['h2', 'du_lich']]);
  });

  it('⭐ hũ CHƯA phân loại: nhãn vắng mặt, nhưng kết cục vẫn phát', () => {
    // Nối tiếp D193: "chưa phân loại" không bị đoán hộ thành `khac`. Nhưng trạng thái thì
    // luôn biết được, nên nó vẫn đi.
    const goi = dongGoiKy({ ky: '2026-08', so: [], hu: [hu({ ten: 'Gì đó' }, 'h9')] });
    expect(goi.dong.some((d) => d.ma === 'y_loai')).toBe(false);
    expect(goi.dong.find((d) => d.ma === 'kq_bo_giua_chung')?.giaTri).toBe('con_theo');
  });

  it('⭐ TẠM DỪNG chưa phải là BỎ (C8) — hai quỹ đạo khác hẳn nhau', () => {
    const dung = doiTrangThai(hu({ ten: 'A' }, 'h1'), 'tam_dung', LUC);
    const bo = doiTrangThai(hu({ ten: 'B' }, 'h2'), 'bo_do', LUC);
    expect(ketCuc(dung)).toBe('con_theo');
    expect(ketCuc(bo)).toBe('bo');
    expect(ketCuc(doiTrangThai(hu({ ten: 'C' }, 'h3'), 'xong', LUC))).toBe('xong');
  });

  it('đếm tạm dừng: chỉ đếm `tam_dung`, không đếm cú bỏ', () => {
    let h = hu({ ten: 'A' }, 'h1');
    h = doiTrangThai(h, 'tam_dung', LUC);
    h = doiTrangThai(h, 'dang_chay', LUC);
    h = doiTrangThai(h, 'tam_dung', LUC);
    h = doiTrangThai(h, 'bo_do', LUC);
    expect(demTamDung(h)).toBe(2);
  });

  it('⭐ hướng sửa mức chở HƯỚNG, không chở SỐ TIỀN', () => {
    let h = hu({ ten: 'A', muc: 1_000_000 }, 'h1');
    h = sua(h, { muc: 3_000_000 }, LUC);   // tăng
    h = sua(h, { muc: 2_000_000 }, LUC);   // giảm
    h = sua(h, { muc: 1_500_000 }, LUC);   // giảm
    const p = huongSuaMuc(h);
    expect(p).toEqual({ tang: lamTron3(1 / 3), giam: lamTron3(2 / 3), khong: 0 });
    expect(JSON.stringify(p)).not.toContain('3000000');
  });

  it('chưa sửa lần nào ⇒ `{khong: 1}` — một phát biểu THẬT, không phải thiếu mẫu', () => {
    // "Chưa bao giờ đổi mục tiêu" là một chân dung, khác hẳn "chưa đo được".
    expect(huongSuaMuc(hu({ ten: 'A', muc: 500_000 }, 'h1')))
      .toEqual({ tang: 0, giam: 0, khong: 1 });
  });
});

describe('§VII — ⭐⭐⭐ `kq_dat_muc_tieu`: vắng mặt thì vắng HẲN', () => {
  const dongCua = (goi: ReturnType<typeof dongGoiKy>, ma: string) =>
    goi.dong.filter((d) => d.ma === ma);

  it('⭐⭐⭐ hũ ĐANG CHẠY không sinh dòng nào — mẫu số phải là số hũ ĐÃ CHỐT', () => {
    /*
     * ⚠⚠ Đây là chỗ một con số bán được nhất của cohort intelligence hỏng theo hướng
     * KHÔNG AI THẤY. Nếu hũ đang chạy cũng sinh một nấc (dù là nấc "thấp nhất"), thì
     * "tỷ lệ đạt mục tiêu" chia cho **mọi hũ từng tồn tại**, và nó tụt xuống theo số
     * người mới — một chỉ số đo lượng người mới, đội lốt chỉ số kết quả.
     * ⇒ Không có câu trả lời thì không có dòng. P7/D62.
     */
    const goi = dongGoiKy({
      ky: '2026-08', so: SO_DAY,
      hu: [hu({ ten: 'Đang chạy' }, 'h1'), hu({ ten: 'Cũng đang chạy' }, 'h2')],
    });
    expect(dongCua(goi, 'kq_dat_muc_tieu')).toHaveLength(0);
    expect(dongCua(goi, 'kq_bo_giua_chung'), 'trạng thái thì VẪN có, hai trục khác nhau')
      .toHaveLength(2);
  });

  it('⭐⭐ đóng hũ mà KHÔNG quyết toán cũng không sinh dòng', () => {
    /*
     * ⚠ Đường `doiTrangThai` trần vẫn tồn tại (máy trạng thái là của nó). Một hũ đi qua
     * đường ấy là hũ **chưa ai hỏi** — và nó phải im, chứ không được nhận một nấc mặc
     * định để "cho đủ bộ".
     */
    const h = doiTrangThai(hu({ ten: 'Đóng lặng' }, 'h1'), 'xong', LUC);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [h] });
    expect(dongCua(goi, 'kq_dat_muc_tieu')).toHaveLength(0);
  });

  it('⭐⭐ hũ đã quyết toán sinh ĐÚNG một dòng, gắn đúng hũ, đúng nấc user chọn', () => {
    const a = quyetToan(hu({ ten: 'Xong' }, 'h1'), 'xong', 'du', LUC);
    const b = quyetToan(hu({ ten: 'Bỏ' }, 'h2'), 'bo_do', 'dang_tien', LUC);
    const goi = dongGoiKy({
      ky: '2026-08', so: SO_DAY, hu: [a, b, hu({ ten: 'Còn chạy' }, 'h3')],
    });
    expect(dongCua(goi, 'kq_dat_muc_tieu').map((d) => [d.doiTuong, d.giaTri]))
      .toEqual([['h1', 'du'], ['h2', 'dang_tien']]);
  });

  it('⭐⭐⭐ HŨ CŨ trong kho KHÔNG có khoá `ketQua` — `undefined` cũng phải im', () => {
    /*
     * ⚠⚠ CA DI TÍCH, và nó chỉ nổ trên máy NGƯỜI DÙNG. Hũ ghi vào IndexedDB trước lượt
     * thêm trường này đọc lên là `undefined`; `!== null` cho `undefined` là **đúng**, nên
     * ta sẽ phát `kq_dat_muc_tieu: undefined`, `kiemGiaTri` ném, và cả gói kỳ ấy hỏng.
     * ⚠ Mọi bài khác dựng hũ bằng `tuTao()` nên trường luôn có — tức không bài nào chạm
     *   tới ca này. Phải dựng bản ghi THIẾU TRƯỜNG bằng tay, đúng hình dữ liệu cũ.
     * ⚠⚠ CHỐT THẬT NẰM Ở `them()` (nó bỏ qua `null`/`undefined` ở cửa), không ở vòng lặp
     *   hũ. Bản đầu tôi đặt thêm một `if` ở vòng lặp rồi viết bài này để canh nó — tiêm
     *   lỗi vào cái `if` ấy bắt **0 bài**, vì `them()` vẫn chặn. Hai chốt chồng nhau thì
     *   bài test không canh được cái nào. Đã bỏ `if`; bài này giờ canh đúng `them()`.
     */
    const { ketQua: _bo, ...cu } = hu({ ten: 'Hu cu' }, 'h1');
    const dong = doiTrangThai(cu as Hu, 'xong', LUC);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [dong] });
    expect(dongCua(goi, 'kq_dat_muc_tieu')).toHaveLength(0);
    expect(() => soiGoi(goi)).not.toThrow();
    expect(soiGoi(goi), 'gói vẫn hợp lệ, không có dòng rác').toEqual([]);
  });

  it('⭐⭐ HAI TRỤC KHÔNG TRỘN: bỏ dở mà gom đủ vẫn ra `bo` + `du`', () => {
    /*
     * `kq_bo_giua_chung` đo TRẠNG THÁI, `kq_dat_muc_tieu` đo LƯỢNG. Người gom đủ rồi
     * mới đổi ý là một quỹ đạo có thật; suy trục này từ trục kia là mất nó.
     */
    const h = quyetToan(hu({ ten: 'Đủ rồi vẫn bỏ' }, 'h1'), 'bo_do', 'du', LUC);
    const goi = dongGoiKy({ ky: '2026-08', so: SO_DAY, hu: [h] });
    expect(dongCua(goi, 'kq_bo_giua_chung')[0]!.giaTri).toBe('bo');
    expect(dongCua(goi, 'kq_dat_muc_tieu')[0]!.giaTri).toBe('du');
  });
});
