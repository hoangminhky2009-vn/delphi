/**
 * DỮ LIỆU MẪU gieo vào IndexedDB `delphi_pfm` cho kịch bản trình duyệt PFM (xem `pfm_ha_tang.mjs`). Số là VÍ DỤ, không phải dữ liệu thật.
 * Ba trạng thái theo SPEC mục 5: `rong` (sổ rỗng) · `co` (có dữ liệu: sổ + hũ tiết kiệm/chi + hũ con + hồ sơ phỏng vấn) · khách (không IDB).
 */
import { khoan, hu, hoSo } from './pfm_ha_tang.mjs';

/** `nay` = `YYYY-MM-DD` (ngày VN). */
export function homNayVN() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }
export const lui = (nay, n) => { const d = new Date(`${nay}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const cong = (nay, n) => lui(nay, -n);

export function mauRong() { return { khoan: [], hu: [], hu_con: [], meta: [] }; }

export function mauCo(nay = homNayVN()) {
  const han = cong(nay, 120);
  const ks = [
    khoan('k1', nay, 45000, 'chi', { ghiChu: 'Cơm trưa', gio: '05:00:00' }),
    khoan('k2', nay, 25000, 'chi', { ghiChu: 'Cà phê', gio: '03:00:00' }),
    khoan('k3', nay, 15000, 'chi', { ghiChu: 'Gửi xe', gio: '02:00:00' }),
    khoan('k4', lui(nay, 1), 40000, 'chi', { ghiChu: 'Bún chả' }),
    khoan('k5', lui(nay, 2), 240000, 'chi'),
    khoan('k6', lui(nay, 3), 130000, 'chi'),
    khoan('k7', lui(nay, 4), 3000000, 'thu', { ghiChu: 'Lương' }),
    khoan('k8', lui(nay, 5), 800000, 'thu', { ghiChu: 'Lương thêm' }),
    // đã chia vào hũ tiết kiệm (phân bổ ví → hũ)
    khoan('n1', lui(nay, 3), 900000, 'chi', { huId: 'h1', phanBo: 'tay' }),
    khoan('n2', lui(nay, 2), 300000, 'chi', { huId: 'h3', phanBo: 'tay' }),
    // chi đã chia vào hũ chi (gán)
    khoan('g1', lui(nay, 2), 60000, 'chi', { huId: 'h4', phanBo: 'gan' }),
  ];
  const hs = [
    hu('h1', 'Quỹ dự phòng', {
      muc: 6000000, sao: true, icon: 'shield', loai: 'du_phong',
      lenh: { tu: lui(nay, 20), kyHan: han },
      loiDoan: [{ muc: 6000000, han, chac: 'vua', datLuc: `${lui(nay, 20)}T00:00:00.000Z` }],
    }),
    hu('h2', 'Laptop học', { muc: 15000000, icon: 'chart', loai: 'thiet_bi' }),
    hu('h3', 'Đà Lạt', { muc: 3000000, icon: 'target', loai: 'du_lich' }),
    hu('h4', 'Ăn uống', { muc: 1500000, icon: 'coin', nhom: 'tieu_dung' }),
    hu('h5', 'Đi lại', { muc: 500000, icon: 'bolt', nhom: 'tieu_dung' }),
  ];
  const cons = [
    { id: 'c1', thang: nay.slice(0, 7), suaLuc: `${lui(nay, 3)}T09:00:00.000Z`, d: { id: 'c1', chaId: 'h3', ten: 'Vé xe', muc: 600000, khoanIds: ['n2'], taoLuc: `${lui(nay, 3)}T09:00:00.000Z` } },
    { id: 'c2', thang: nay.slice(0, 7), suaLuc: `${lui(nay, 3)}T09:01:00.000Z`, d: { id: 'c2', chaId: 'h3', ten: 'Ở', muc: 1600000, khoanIds: [], taoLuc: `${lui(nay, 3)}T09:01:00.000Z` } },
  ];
  const meta = [hoSo({
    nhip: ['sau tiền về'], lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái',
  })];
  return { khoan: ks, hu: hs, hu_con: cons, meta };
}
