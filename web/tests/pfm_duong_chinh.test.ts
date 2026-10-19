/**
 * PFM — ĐƯỜNG CHÍNH: một người dùng đi trọn một tháng. D202.
 *
 * ⚠⚠ VÌ SAO BÀI NÀY TỒN TẠI DÙ BẢY MODULE ĐỀU ĐÃ CÓ TEST RIÊNG: bảy bộ test đơn lẻ chứng
 * minh **từng khúc đúng**, không chứng minh **chúng nối được với nhau**. Mỗi bộ dựng đầu
 * vào bằng tay, nên một khớp nối lệch (sai tên trường, sai thứ tự bước, một `id` không
 * khớp) đi lọt qua cả bảy mà vẫn xanh. Đây là luật D78 — *đo trên ĐƯỜNG CHÍNH, không đo
 * trên đường tắt*.
 *
 * Kịch bản: mở app → ghi sổ cả tháng → tạo hai hũ và góp vào → soi gương → đóng gói đặc
 * trưng → xếp hàng đợi → gửi → đóng két → **mất máy** → khôi phục trên máy mới.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { KhoTrongBoNho, thangCua, type BanGhi } from '../src/pfm/kho.js';
import { moKho } from '../src/pfm/kho_idb.js';
import { taoKhoan, khoanRaBanGhi, tongGopVaoHu, congSo, type Khoan } from '../src/pfm/so.js';
import { tuTao, tienDo, sapXep, type Hu } from '../src/pfm/hu.js';
import { guongKy } from '../src/pfm/guong.js';
import { dongGoiKy, soiGoi } from '../src/pfm/dac_trung.js';
import { xepHang, layLo, xacNhanGui, type MonHangDoi } from '../src/pfm/dong_bo.js';
import {
  suyKhoa, dongLat, moLat, gomLat, kiemTran, hoaGiai, chuanMa, taoMaKhoiPhuc, mocMa,
  DAI_MUOI, LAT_SONG, type RuotLat,
} from '../src/pfm/ket.js';
import { PFM } from '@config/pfm';

const KY = '2026-08';
const luc = (d: number) => `2026-08-${String(d).padStart(2, '0')}T09:00:00.000Z`;
const ngay = (d: number) => `2026-08-${String(d).padStart(2, '0')}`;

/** Một tháng ghi sổ thật: chi mỗi ngày, hai lần lương, vài khoản góp hũ. */
function dungMotThang(): { so: Khoan[]; hu: Hu[] } {
  let n = 0;
  const k = (d: number, nghin: number, v: Parameters<typeof taoKhoan>[0] | object = {}) =>
    taoKhoan({ ngay: ngay(d), soTien: nghin * 1000, ...v } as Parameters<typeof taoKhoan>[0],
      luc(d), `k${n++}`);

  const so: Khoan[] = [
    k(1, 6_000, { chieu: 'thu', ngay: ngay(1), soTien: 6_000_000 }),
    k(15, 2_000, { chieu: 'thu', ngay: ngay(15), soTien: 2_000_000 }),
  ];
  // chi đều: 60k/ngày, trừ ngày 2 và 16 tiêu lớn (lĩnh lương xong)
  for (let d = 1; d <= 20; d++) {
    const to = d === 2 || d === 16;
    so.push(k(d, to ? 500 : 60, {
      ngay: ngay(d), soTien: (to ? 500 : 60) * 1000, nhan: 'an_uong',
      ...(d % 4 === 0 ? { viSale: d % 8 === 0 } : {}),
    } as never));
  }
  // góp hũ: `chi` nối vào hũ = GÓP VÀO (quy ước dấu D197)
  so.push(k(3, 1_000, { ngay: ngay(3), soTien: 1_000_000, huId: 'hu-laptop' } as never));
  so.push(k(17, 800, { ngay: ngay(17), soTien: 800_000, huId: 'hu-laptop' } as never));
  so.push(k(18, 200, { ngay: ngay(18), soTien: 200_000, huId: 'hu-du-phong' } as never));

  const hu: Hu[] = [
    tuTao({ ten: 'Laptop học tập', muc: 12_000_000, loai: 'thiet_bi', han: 'vua',
      uuTien: 'cao' }, luc(1), 'hu-laptop'),
    tuTao({ ten: 'Quỹ dự phòng' }, luc(1), 'hu-du-phong'),   // hũ TRẦN TRỤI, chỉ có tên
  ];
  return { so, hu };
}

describe('§ ĐƯỜNG CHÍNH — một tháng, bảy module, một dòng chảy', () => {
  it('⭐⭐ ghi sổ → vào kho → soi gương → đóng gói → hàng đợi → gửi', async () => {
    const kho = new KhoTrongBoNho();
    const { so, hu } = dungMotThang();

    /* 1. GHI SỔ vào kho — mỗi khoản rơi đúng lát tháng của NGÀY nó */
    await kho.ghiLo('khoan', so.map(khoanRaBanGhi));
    await kho.ghiLo('hu', hu.map((h) => ({
      id: h.id, thang: thangCua(h.taoLuc.slice(0, 10)), suaLuc: h.taoLuc, d: h })));
    expect(await kho.dem('khoan')).toBe(so.length);

    /* 1b. GHI BÙ một khoản của THÁNG TRƯỚC — ghi hôm nay, nhưng nó thuộc về tháng 7 */
    const buThang7 = taoKhoan({ ngay: '2026-07-28', soTien: 250_000 }, luc(20), 'k-bu');
    await kho.ghi('khoan', khoanRaBanGhi(buThang7));

    /* 2. ĐỌC LẠI TỪ KHO — từ đây trở đi mọi thứ đi qua kho, không dùng mảng gốc */
    const doc = (await kho.liet<Khoan>('khoan', { thang: KY })).map((b) => b.d);
    expect(doc, 'mọi khoản của tháng 8 đọc lại được').toHaveLength(so.length);
    /*
     * ⚠⚠ Khoản ghi bù phải rơi vào lát THÁNG 7, không phải tháng ghi. Suy tháng từ NGÀY
     * GHI thay vì NGÀY CỦA KHOẢN là một bug im lặng: khoản biến mất khỏi mọi phép tính
     * của tháng nó thuộc về, mà tháng đó thì đã niêm phong nên không ai đi tìm nữa.
     */
    expect(doc.some((k) => k.id === 'k-bu'), 'không được lẫn vào tháng 8').toBe(false);
    expect((await kho.liet<Khoan>('khoan', { thang: '2026-07' })).map((b) => b.id))
      .toEqual(['k-bu']);

    /* 3. HŨ — tiến độ tính TỪ SỔ, không đọc con số dán sẵn (D197) */
    const gop = tongGopVaoHu(doc, 'hu-laptop');
    expect(gop, '1.000.000 + 800.000').toBe(1_800_000);
    expect(tienDo(hu[0]!, gop)).toBeCloseTo(0.15, 10);
    expect(tienDo(hu[1]!, tongGopVaoHu(doc, 'hu-du-phong')),
      'hũ chưa đặt mức ⇒ chưa có tiến độ, KHÔNG phải 0').toBeNull();
    expect(sapXep(hu, (id) => tongGopVaoHu(doc, id)).map((h) => h.id))
      .toEqual(['hu-laptop', 'hu-du-phong']);   // ưu tiên cao lên trước

    /* 4. GƯƠNG — số nói được thì nói, số chưa đủ mẫu thì im */
    const g = guongKy(doc);
    expect(g.tiet_kiem_rong.gt, 'thu 8tr, chi 3,08tr ⇒ ~0,615').toBeCloseTo(
      (congSo(doc).thu - congSo(doc).chi) / congSo(doc).thu, 10);
    expect(g.chi_bu.gt, 'đủ ngày ⇒ nói được').not.toBeNull();
    expect(g.vi_sale.gt, 'đã hỏi 5 khoản ⇒ nói được').not.toBeNull();

    /* 5. ĐẶC TRƯNG — đóng gói, và gói phải sạch theo chính sổ đăng ký */
    const goi = dongGoiKy({ ky: KY, so: doc, hu });
    expect(soiGoi(goi), 'gói do chính máy dựng phải sạch').toEqual([]);
    const s = JSON.stringify(goi);
    expect(s, 'không tên hũ').not.toContain('Laptop');
    expect(s, 'không số tiền').not.toContain('12000000');
    expect(s, 'không số tiền').not.toContain('1800000');
    // hũ TRẦN TRỤI vẫn có kết cục, nhưng KHÔNG có nhãn bịa (D193)
    const cuaTranTrui = goi.dong.filter((d) => d.doiTuong === 'hu-du-phong');
    expect(cuaTranTrui.map((d) => d.ma).sort())
      .toEqual(['hv_sua_muc_tieu', 'hv_tam_dung_hu', 'kq_bo_giua_chung']);

    /* 6. HÀNG ĐỢI → GỬI → XÁC NHẬN */
    const mon: MonHangDoi = { loai: 'goi', ky: KY, goi };
    await xepHang(kho, mon, luc(20), 'i1', KY);
    await xepHang(kho, { loai: 'nhip', ma: 'pfm_diem_danh', v: { ngay: ngay(20) } },
      luc(20), 'n1', KY);
    const lo = await layLo(kho);
    expect(lo.ids).toHaveLength(2);
    expect(lo.byte).toBeLessThanOrEqual(64 * 1024);

    // gửi HỎNG ⇒ món ở nguyên
    expect((await layLo(kho)).ids).toEqual(lo.ids);
    // gửi ĐƯỢC ⇒ hàng đợi sạch
    expect(await xacNhanGui(kho, lo.ids)).toBe(0);
  });

  it('⭐⭐ MẤT MÁY: đóng két → máy mới khôi phục → không mất một dòng nào', async () => {
    const kho = new KhoTrongBoNho();
    const { so, hu } = dungMotThang();
    await kho.ghiLo('khoan', so.map(khoanRaBanGhi));
    await kho.ghiLo('hu', hu.map((h) => ({
      id: h.id, thang: KY, suaLuc: h.taoLuc, d: h })));
    // user xoá một khoản ghi nhầm
    await kho.xoa('khoan', 'k5', luc(20));

    /* ĐÓNG KÉT — mã do MÁY sinh, user chép tay */
    const maGoc = taoMaKhoiPhuc();
    const muoi = new Uint8Array(DAI_MUOI).fill(3);
    const khoa = await suyKhoa(chuanMa(maGoc), muoi);

    const tat = {
      khoan: await kho.liet('khoan', { keCaDaXoa: true }),
      hu: await kho.liet('hu', { keCaDaXoa: true }),
    };
    const latThang = await dongLat(KY, gomLat('thang', tat, KY), khoa);
    const latSong = await dongLat(LAT_SONG, gomLat('song', tat), khoa);
    kiemTran(latThang, PFM.BLOB_MAX);
    kiemTran(latSong, PFM.BLOB_MAX);
    expect(latThang.goi.length, 'một tháng thật còn xa trần 32 KB')
      .toBeLessThan(PFM.BLOB_MAX / 2);

    /* ═══ MÁY MỚI ═══ user gõ lại mã có gạch nối, chữ thường */
    const khoMoi = await (async () => {
      await new Promise<void>((ok) => {
        const r = indexedDB.deleteDatabase('delphi_pfm_u1');
        r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
      });
      return moKho('u1');
    })();
    // ...và trước khi nhớ ra có sao lưu, họ đã ghi một khoản mới
    const moiTinh = taoKhoan({ ngay: ngay(25), soTien: 90_000 }, luc(25), 'k-moi');
    await khoMoi.ghi('khoan', khoanRaBanGhi(moiTinh));

    const khoaMoi = await suyKhoa(chuanMa(mocMa(maGoc).toLowerCase()), muoi);
    const ruotThang = await moLat(latThang, khoaMoi) as RuotLat;
    const ruotSong = await moLat(latSong, khoaMoi) as RuotLat;

    const kq = hoaGiai(
      await khoMoi.liet<Khoan>('khoan', { keCaDaXoa: true }),
      ruotThang.khoan as BanGhi<Khoan>[]);
    await khoMoi.ghiLo('khoan', kq.ra);
    await khoMoi.ghiLo('hu', ruotSong.hu!);

    /* ═══ KIỂM ═══ */
    expect(kq.can, 'không chỗ nào cấn').toEqual([]);
    /*
     * ⚠⚠ KIỂM TRÊN `kq.ra`, KHÔNG CHỈ KIỂM TRÊN KHO — và bản đầu của bài này sai đúng
     * chỗ đó. Tôi chỉ kiểm cái kho sau `ghiLo(kq.ra)`, mà `ghiLo` GHI CHỨ KHÔNG XOÁ, nên
     * một bản ghi bị hoà giải đánh rơi vẫn còn nguyên trong kho từ trước. Mũi tiêm "coi
     * vắng mặt là lệnh xoá" vì thế **đi lọt qua cả bài end-to-end**. Kết quả hoà giải là
     * thứ phải kiểm; cái kho chỉ nói lên `ghiLo` có chạy không.
     */
    expect(kq.ra.some((b) => b.id === 'k-moi'),
      'hoà giải phải GIỮ khoản chỉ có ở máy — vắng mặt trong két ≠ lệnh xoá').toBe(true);
    expect(kq.ra.find((b) => b.id === 'k5')?.daXoa,
      'bia mộ đi theo két nên cú xoá lan sang máy mới').toBe(true);

    const sauKhoiPhuc = await khoMoi.liet<Khoan>('khoan', { thang: KY });
    expect(sauKhoiPhuc.some((b) => b.id === 'k5'),
      'khoản đã xoá KHÔNG sống lại').toBe(false);
    expect(await khoMoi.doc('khoan', 'k-moi'),
      'và nó vẫn đọc được từ kho sau khi ghi').not.toBeNull();
    expect((await khoMoi.liet('hu')).map((b) => b.id).sort())
      .toEqual(['hu-du-phong', 'hu-laptop']);

    /* và gương trên máy mới ra ĐÚNG con số của máy cũ */
    const cu = guongKy((await kho.liet<Khoan>('khoan', { thang: KY })).map((b) => b.d));
    const moi = guongKy(sauKhoiPhuc.map((b) => b.d).filter((k) => k.id !== 'k-moi'));
    expect(moi.chi_bu.gt).toBe(cu.chi_bu.gt);
    expect(moi.tiet_kiem_rong.gt).toBe(cu.tiet_kiem_rong.gt);

    khoMoi.dong();
  });

  it('⭐ SAI MÃ trên máy mới ⇒ hỏng TO, và sổ đang có KHÔNG bị đụng', async () => {
    // Đây là khoảnh khắc user hoảng nhất. Trả rác hay trả `{}` ở đây làm họ tưởng mất
    // sổ; và tệ hơn, một cú "khôi phục" từ rác sẽ đè lên sổ thật đang có trên máy.
    const { so } = dungMotThang();
    const muoi = new Uint8Array(DAI_MUOI).fill(3);
    const lat = await dongLat(KY, { khoan: so.slice(0, 3).map(khoanRaBanGhi) },
      await suyKhoa(chuanMa(taoMaKhoiPhuc()), muoi));

    const kho = new KhoTrongBoNho();
    await kho.ghi('khoan', khoanRaBanGhi(so[0]!));
    await expect(moLat(lat, await suyKhoa(chuanMa(taoMaKhoiPhuc()), muoi))).rejects.toThrow();
    expect(await kho.dem('khoan'), 'sổ đang có còn nguyên').toBe(1);
  });
});
