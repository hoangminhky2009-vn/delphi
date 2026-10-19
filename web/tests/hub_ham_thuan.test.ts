/**
 * HUB — HÀM THUẦN (không React): ô Tài chính đọc sổ trên máy · banner bách khoa · lá bài thành đường SVG.
 * Mục đích bài: logic quyết định "ô hiện gì" không được chỉ sống trong JSX — nó có số học thật (làm tròn tiền, chọn hũ sao, thứ
 * tự ưu tiên) và có bẫy D62 (chưa có ≠ 0).
 */
import { describe, expect, it } from 'vitest';
import { BANG_MAU } from '@config/pixel_luoi';
import { LA_BAI } from '@server/art/la_bai';
import { MUC_THEO_ID } from '@/lib/bach_khoa';
import { ID_BANNER, chuoiDau, duongVeLuoi, goiMo, heSoTayBai, khungCat } from '@/lib/hub_banner';
import { cheDoHienThi, chieuCaoCot, thuCuaNgay, tienGon, tomTatHub } from '@/lib/hub_tai_chinh';
import { laHuCoSao, tuTao, type Hu } from '@/pfm/hu';
import { taoKhoan, type Khoan } from '@/pfm/so';

const LUC = '2026-10-11T03:00:00.000Z';
const NAY = '2026-10-11';
let n = 0;
const khoan = (ngay: string, soTien: number, p: Partial<Parameters<typeof taoKhoan>[0]> = {}): Khoan =>
  taoKhoan({ ngay, soTien, chieu: 'chi', ...p }, LUC, `k${n += 1}`);
const hu = (ten: string, p: Partial<Parameters<typeof tuTao>[0]> = {}, id = ten): Hu => tuTao({ ten, ...p }, LUC, id);

describe('tienGon — số tiền gọn cho ô nhỏ', () => {
  it('đơn vị theo bậc: đ · k · tr; một chữ số thập phân khi dưới 10 đơn vị', () => {
    expect(tienGon(0)).toEqual({ so: '0', don: 'đ' });
    expect(tienGon(850)).toEqual({ so: '850', don: 'đ' });
    expect(tienGon(5_500)).toEqual({ so: '5,5', don: 'k' });
    expect(tienGon(85_000)).toEqual({ so: '85', don: 'k' });
    expect(tienGon(240_000)).toEqual({ so: '240', don: 'k' });
    expect(tienGon(1_250_000)).toEqual({ so: '1,3', don: 'tr' });
    expect(tienGon(20_000_000)).toEqual({ so: '20', don: 'tr' });
  });
  it('không bao giờ âm / NaN-hoá (kẹp về 0)', () => {
    expect(tienGon(-5)).toEqual({ so: '0', don: 'đ' });
  });
});

describe('tomTatHub — từ sổ + hũ ra thứ ô cần vẽ', () => {
  it('⭐ chi hôm nay + dải 7 ngày (6 ngày trước + hôm nay), chỉ đếm TIÊU, không đếm tiền vào', () => {
    const t = tomTatHub([
      khoan(NAY, 85_000), khoan(NAY, 15_000),
      khoan('2026-10-10', 40_000),
      khoan('2026-10-04', 999),                      // ngoài cửa sổ 7 ngày (cửa sổ = 05→11/10)
      khoan(NAY, 5_000_000, { chieu: 'thu' }),       // tiền VÀO không phải tiêu
    ], [], NAY);
    expect(t.coSo).toBe(true);
    expect(t.chiHomNay).toBe(100_000);
    expect(t.chi7).toHaveLength(7);
    expect(t.chi7[6]).toMatchObject({ ngay: NAY, chi: 100_000 });
    expect(t.chi7[5]).toMatchObject({ ngay: '2026-10-10', chi: 40_000 });
    expect(t.chi7.map((x) => x.thu)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);   // 05/10/2026 là thứ Hai, 11/10 là Chủ nhật
  });

  it('⭐ D62: sổ RỖNG ⇒ coSo=false (ô vẽ icon, không in số 0)', () => {
    const t = tomTatHub([], [], NAY);
    expect(t.coSo).toBe(false);
    expect(t.huSao).toBeNull();
    expect(t.tienToiNgay).toBeNull();
  });

  it('⭐⭐ hũ SAO: chỉ hũ tự đặt ưu tiên CAO; hũ từ mẫu / ưu tiên thấp không được sao', () => {
    expect(laHuCoSao(hu('A', { uuTien: 'cao' }))).toBe(true);
    expect(laHuCoSao(hu('B', { uuTien: 'thap' }))).toBe(false);
    expect(laHuCoSao(hu('C'))).toBe(false);
    expect(laHuCoSao({ ...hu('D', { uuTien: 'cao' }), tuMauId: 'quy_du_phong' })).toBe(false);
  });

  it('hũ sao đầu tiên theo thứ tự màn HŨ; tiến độ = đã góp / mức; hũ ĐÃ XONG không tính', () => {
    const a = hu('Laptop', { uuTien: 'cao', muc: 20_000_000 }, 'a');
    const xong: Hu = { ...hu('Cũ', { uuTien: 'cao', muc: 1_000_000 }, 'x'), trangThai: 'xong' };
    const sổ = [khoan(NAY, 5_000_000, { huId: 'a' })];
    const t = tomTatHub(sổ, [xong, a], NAY);
    expect(t.huSao).toMatchObject({ id: 'a', ten: 'Laptop', daGop: 5_000_000, muc: 20_000_000, tieuDung: false });
    expect(t.huSao!.tienDo).toBeCloseTo(0.25);
  });

  it('hũ sao chưa đặt mức ⇒ tienDo null (không bịa 0 %)', () => {
    const t = tomTatHub([khoan(NAY, 1000)], [hu('Quỹ', { uuTien: 'cao' })], NAY);
    expect(t.huSao!.muc).toBeNull();
    expect(t.huSao!.tienDo).toBeNull();
  });
});

describe('cheDoHienThi — mặc định hũ sao; chưa có ⇒ chi hôm nay; lựa chọn của người chơi thắng', () => {
  const khongSao = tomTatHub([khoan(NAY, 10_000)], [], NAY);
  const coSao = tomTatHub([khoan(NAY, 10_000)], [hu('L', { uuTien: 'cao', muc: 100 })], NAY);
  it('chưa chọn: có sao ⇒ hũ sao; không sao ⇒ chi hôm nay', () => {
    expect(cheDoHienThi(null, coSao)).toBe('hu_sao');
    expect(cheDoHienThi(null, khongSao)).toBe('chi_hom_nay');
  });
  it('đã chọn: tôn trọng; chọn hũ sao mà không còn sao ⇒ rơi về chi hôm nay (ô không trống)', () => {
    expect(cheDoHienThi('chi_hom_nay', coSao)).toBe('chi_hom_nay');
    expect(cheDoHienThi('tien_toi_ngay', coSao)).toBe('tien_toi_ngay');
    expect(cheDoHienThi('hu_sao', khongSao)).toBe('chi_hom_nay');
  });
});

describe('phụ trợ vẽ ô', () => {
  it('cột 0 vẫn có vạch 4 % (thấy "ngày này không chi"); cột lớn nhất 100 %', () => {
    expect(chieuCaoCot(0, 100)).toBe(4);
    expect(chieuCaoCot(100, 100)).toBe(100);
    expect(chieuCaoCot(50, 0)).toBe(4);
  });
  it('thứ của ngày tính trên chuỗi UTC — không đổi theo múi giờ máy', () => {
    expect(thuCuaNgay('2026-10-11')).toBe('CN');
    expect(thuCuaNgay('2026-10-12')).toBe('T2');
  });
});

describe('banner — nội dung từ BÁCH KHOA, không chép tay', () => {
  it('⭐ cả tám id của banner đều có THẬT trong bách khoa (đổi tên mục ở bách khoa mà quên banner ⇒ đỏ)', () => {
    expect(ID_BANNER).toHaveLength(8);
    for (const id of ID_BANNER) expect(MUC_THEO_ID.get(id), `banner trỏ mục không tồn tại: ${id}`).toBeTruthy();
    expect(ID_BANNER[0], 'cảnh ĐẦU luôn mở bài THIÊN NGA ĐEN').toBe('thien_nga');
  });

  it('⭐ câu gợi mở: "VÌ SAO …" ⇒ "Vì sao …?"; không có chuỗi hỏi ⇒ câu nhắc của mục', () => {
    for (const id of ID_BANNER) {
      const m = MUC_THEO_ID.get(id)!;
      const g = goiMo(m);
      expect(g.length, id).toBeGreaterThan(8);
      const ten = chuoiDau(m)?.ten.trim() ?? '';
      if (/^VÌ SAO /.test(ten)) expect(g, id).toMatch(/^Vì sao .+\?$/);
      else expect(g, id).toBe(m.nhac);
    }
    expect(goiMo({ chuoi: { ten: 'VÌ SAO LẠM PHÁT LÀM TIỀN MẤT GIÁ', buoc: [], ket: '' }, nhac: 'x' })).toBe('Vì sao lạm phát làm tiền mất giá?');
  });

  it('hệ số thu tay bài kẹp 0,4–0,8 theo bề rộng banner', () => {
    expect(heSoTayBai(50)).toBe(0.4);
    expect(heSoTayBai(10_000)).toBe(0.8);
    expect(heSoTayBai(8 + 350 * 0.6)).toBeCloseTo(0.6);
  });
});

describe('lá bài: lưới ký tự → đường SVG', () => {
  it('gộp các ô cùng màu liền nhau theo hàng; "." và ký tự lạ trong suốt', () => {
    const d = duongVeLuoi(['GGG.q', '..??.'], { G: '#0f0', q: '#f00' });
    expect(d.get('G')).toBe('M0,0h3v1h-3z');
    expect(d.get('q')).toBe('M4,0h1v1h-1z');
    expect(d.size).toBe(2);
  });
  it('viewBox cắt khung trống: hình ở giữa lưới ⇒ vuông ôm sát hình', () => {
    expect(khungCat(['....', '.GG.', '.GG.', '....'], { G: '#0f0' })).toBe('1 1 2 2');
    expect(khungCat(['...'], { G: '#0f0' })).toBe('0 0 3 1');
  });
  it('⭐ ba lá của tay bài có THẬT trong server/art và dùng đủ màu trong bảng', () => {
    for (const khoa of ['gd_tang', 'gd_giam', 'sk_thien_nga_den']) {
      const luoi = LA_BAI[khoa]?.luoi;
      expect(luoi, khoa).toBeTruthy();
      const duong = duongVeLuoi(luoi!, BANG_MAU);
      expect(duong.size, khoa).toBeGreaterThan(2);
      expect(khungCat(luoi!, BANG_MAU), khoa).toMatch(/^[\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
    }
  });
});
