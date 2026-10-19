/**
 * PFM — ĐỒNG BỘ (K11). D201.
 *
 *   §I   HAI LOẠI MÓN — gói GỘP theo kỳ, nhịp KHÔNG BAO GIỜ gộp.
 *   §II  LÔ — cắt theo cả số món LẪN số byte.
 *   §III XÁC NHẬN — chỉ bỏ khỏi hàng đợi SAU khi server nhận.
 *   §IV  TRẦN THEO NGÀY.
 *   §V   RÀNG BUỘC CẤU TRÚC.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  xepHang, layLo, xacNhanGui, khoaMon, demTrongNgay, ghiNhanGui,
  conLuotLo, conLuotKet, LoiDongBo, raWire, type MonHangDoi,
} from '../src/pfm/dong_bo.js';
import { kiemPhongBiMon } from '@config/pfm_dong_bo';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { KIEU_LAT } from '../src/pfm/ket.js';
import { SCHEMA_VERSION, type MaDacTrung } from '@config/pfm_dac_trung';
import { PFM, PFM_LO } from '@config/pfm';

const LUC = '2026-08-31T10:00:00.000Z';
const NGAY = '2026-08-31';
const THANG = '2026-08';

const goi = (ky: string, gt = 0.25): MonHangDoi => ({
  loai: 'goi', ky,
  goi: { ky, schemaVersion: SCHEMA_VERSION, dong: [{ ma: 'hv_chi_bu', giaTri: gt }] },
});
const nhip = (ma: string): MonHangDoi => ({ loai: 'nhip', ma, v: { hu_id: 'h1' } });

let kho: KhoTrongBoNho;
beforeEach(() => { kho = new KhoTrongBoNho(); });

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — HAI LOẠI MÓN
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — gói GỘP theo kỳ, nhịp KHÔNG BAO GIỜ gộp', () => {
  it('⭐⭐ gói mới của CÙNG MỘT KỲ thay gói cũ — hàng đợi chặn theo SỐ KỲ', () => {
    /*
     * Server chỉ cần bản mới nhất của một kỳ; giữ cả hai là gửi hai lần cùng một sự thật.
     * Nhờ luật này hàng đợi bị chặn theo số KỲ (một tá), không theo số lần mở app — mở
     * app 300 lần trong tháng vẫn chỉ một dòng cho tháng đó.
     */
    expect(khoaMon(goi('2026-08'), 'x')).toBe(khoaMon(goi('2026-08'), 'y'));
    expect(khoaMon(goi('2026-08'), 'x')).not.toBe(khoaMon(goi('2026-07'), 'x'));
  });

  it('⭐⭐ NHỊP không bao giờ gộp — mỗi dòng là một sự kiện đã xảy ra', () => {
    /*
     * Nhịp đi vào `events` APPEND-ONLY. Gộp hai nhịp cùng loại là xoá một sự kiện có
     * thật, và không có bản sao nào để dựng lại. Đây đúng chỗ khuôn telemetry KHÔNG được
     * mượn: telemetry được phép mất dòng, cái này thì không.
     */
    expect(khoaMon(nhip('pfm_diem_danh'), 'a'))
      .not.toBe(khoaMon(nhip('pfm_diem_danh'), 'b'));
  });

  it('xếp hàng: gói cùng kỳ ĐÈ, gói khác kỳ thì thêm dòng', async () => {
    const a = await xepHang(kho, goi('2026-08', 0.25), LUC, 'i1', THANG);
    expect(a).toMatchObject({ nhan: true, thay: false, dangCho: 1 });
    const b = await xepHang(kho, goi('2026-08', 0.5), LUC, 'i2', THANG);
    expect(b).toMatchObject({ thay: true, dangCho: 1 });
    const c = await xepHang(kho, goi('2026-07'), LUC, 'i3', '2026-07');
    expect(c).toMatchObject({ thay: false, dangCho: 2 });
    // và bản còn lại là bản MỚI
    const lo = await layLo(kho);
    const g = lo.mon.find((m) => m.loai === 'goi' && m.ky === '2026-08');
    expect((g as { goi: { dong: { giaTri: unknown }[] } }).goi.dong[0]!.giaTri).toBe(0.5);
  });

  it('xếp hàng: ba nhịp giống hệt nhau vẫn là BA dòng', async () => {
    for (const i of ['a', 'b', 'c']) {
      await xepHang(kho, nhip('pfm_diem_danh'), LUC, i, THANG);
    }
    expect(await kho.dem('outbox')).toBe(3);
  });

  it('⭐ gói HỎNG bị chặn ở CỬA VÀO, không nằm chờ để tắc hàng đợi', async () => {
    /*
     * Một gói hỏng nằm trong hàng đợi sẽ bị server từ chối lặp đi lặp lại và CHẶN ĐỨNG
     * mọi món phía sau — hàng đợi tắc vì một dòng mà không ai nhìn thấy.
     */
    const xau: MonHangDoi = {
      loai: 'goi', ky: '2026-08',
      goi: { ky: '2026-08', schemaVersion: SCHEMA_VERSION,
        dong: [{ ma: 'hv_chi_bu', giaTri: 99 }] },
    };
    await expect(xepHang(kho, xau, LUC, 'i1', THANG)).rejects.toThrow(LoiDongBo);
    expect(await kho.dem('outbox'), 'không được lọt vào hàng đợi').toBe(0);
  });

  it('gói mang mã CỦA SERVER cũng bị chặn ở cửa vào', async () => {
    const xau: MonHangDoi = {
      loai: 'goi', ky: '2026-08',
      goi: { ky: '2026-08', schemaVersion: SCHEMA_VERSION,
        dong: [{ ma: 'hv_ngay_co_mat' as MaDacTrung, giaTri: 20 }] },
    };
    await expect(xepHang(kho, xau, LUC, 'i1', THANG)).rejects.toThrow(/SERVER/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — LÔ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — gom lô', () => {
  it('cũ trước, và báo còn nữa hay không', async () => {
    for (let i = 0; i < 3; i++) {
      await xepHang(kho, nhip('pfm_diem_danh'), `T${i}`, `i${i}`, THANG);
    }
    const lo = await layLo(kho);
    expect(lo.ids).toEqual(['nhip:i0', 'nhip:i1', 'nhip:i2']);
    expect(lo.conNua).toBe(false);
  });

  it('cắt theo TRẦN SỐ MÓN', async () => {
    for (let i = 0; i < PFM_LO.SU_KIEN_MOI_LO + 5; i++) {
      await xepHang(kho, nhip('pfm_diem_danh'), `T${String(i).padStart(3, '0')}`,
        `i${String(i).padStart(3, '0')}`, THANG);
    }
    const lo = await layLo(kho);
    expect(lo.ids).toHaveLength(PFM_LO.SU_KIEN_MOI_LO);
    expect(lo.conNua).toBe(true);
  });

  it('⭐⭐ cắt theo SỐ BYTE — đúng cái bẫy `BACKUP_PAGE` đếm dòng chứ không đếm byte', async () => {
    /*
     * D146 tìm ra `BACKUP_PAGE` đếm DÒNG chứ không đếm BYTE, nên một trang có thể là hàng
     * trăm MB và bản vá "viết dòng chảy" không chặn nổi. Ở đây cùng bẫy: 50 nhịp bé tí thì
     * vô hại, nhưng vài gói nặng thì vượt trần thân request — và request bị nền tảng cắt
     * là hỏng IM LẶNG.
     */
    const nang = (i: number): MonHangDoi => ({
      loai: 'nhip', ma: 'pfm_nang', v: { x: 'z'.repeat(20_000), i },
    });
    for (let i = 0; i < 8; i++) {
      await xepHang(kho, nang(i), `T${i}`, `i${i}`, THANG);
    }
    const lo = await layLo(kho);
    expect(lo.byte).toBeLessThanOrEqual(PFM_LO.THAN_TOI_DA);
    expect(lo.ids.length, 'trần byte cắt trước trần số món').toBeLessThan(8);
    expect(lo.conNua).toBe(true);
  });

  it('⭐ một món ĐƠN LẺ quá trần vẫn được đi — không để hàng đợi tắc vĩnh viễn', async () => {
    // Giữ nó lại là để một dòng không bao giờ vừa chặn đứng mọi thứ phía sau.
    const khong: MonHangDoi = {
      loai: 'nhip', ma: 'pfm_qua_to',
      v: { x: 'z'.repeat(PFM_LO.THAN_TOI_DA + 1000) },
    };
    await xepHang(kho, khong, LUC, 'i1', THANG);
    await xepHang(kho, nhip('pfm_diem_danh'), 'T2', 'i2', THANG);
    const lo = await layLo(kho);
    expect(lo.ids).toEqual(['nhip:i1']);
    expect(lo.conNua).toBe(true);
  });

  it('hàng đợi rỗng ⇒ lô rỗng, không nổ', async () => {
    expect(await layLo(kho)).toMatchObject({ ids: [], mon: [], conNua: false });
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — XÁC NHẬN
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — chỉ bỏ khỏi hàng đợi SAU khi server nhận', () => {
  it('⭐⭐ GỬI HỎNG ⇒ món Ở NGUYÊN, lần sau gửi lại', async () => {
    /*
     * Bỏ món lúc GỬI ĐI là đánh cược rằng mạng không bao giờ đứt giữa chừng — và khi nó
     * đứt, dòng đã biến mất khỏi máy mà chưa từng tới nơi. Không có bản sao nào để dựng
     * lại. Ở đây: lấy lô rồi KHÔNG xác nhận ⇒ lô sau vẫn đúng những món ấy.
     */
    await xepHang(kho, nhip('pfm_diem_danh'), 'T1', 'i1', THANG);
    const lo1 = await layLo(kho);
    // ... gửi hỏng, không gọi xacNhanGui ...
    const lo2 = await layLo(kho);
    expect(lo2.ids).toEqual(lo1.ids);
    expect(await kho.dem('outbox')).toBe(1);
  });

  it('xác nhận thì món biến mất, món chưa gửi ở lại', async () => {
    await xepHang(kho, nhip('a'), 'T1', 'i1', THANG);
    await xepHang(kho, nhip('b'), 'T2', 'i2', THANG);
    const con = await xacNhanGui(kho, ['nhip:i1']);
    expect(con).toBe(1);
    expect((await layLo(kho)).ids).toEqual(['nhip:i2']);
  });

  it('⭐ xác nhận XOÁ HẲN — không để bia mộ trong hàng đợi', async () => {
    /*
     * Bia mộ tồn tại để cú xoá LAN ĐI qua két; mà hàng đợi cố ý KHÔNG vào két. Giữ lại
     * chỉ được một đống xác dòng-đã-gửi phình vô hạn trên máy user.
     */
    await xepHang(kho, nhip('a'), 'T1', 'i1', THANG);
    await xacNhanGui(kho, ['nhip:i1']);
    expect(await kho.liet('outbox', { keCaDaXoa: true })).toEqual([]);
  });

  it('xác nhận một id không có trong hàng đợi là vô hại', async () => {
    await xepHang(kho, nhip('a'), 'T1', 'i1', THANG);
    expect(await xacNhanGui(kho, ['khong-co'])).toBe(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — TRẦN THEO NGÀY
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — trần theo ngày (chặn lạm dụng, không phải nhịp kỳ vọng)', () => {
  it('bộ đếm bắt đầu từ 0 và tăng theo từng loại riêng', async () => {
    expect(await demTrongNgay(kho, NGAY)).toEqual({ ngay: NGAY, lo: 0, ket: 0 });
    await ghiNhanGui(kho, NGAY, 'lo', LUC);
    await ghiNhanGui(kho, NGAY, 'ket', LUC);
    await ghiNhanGui(kho, NGAY, 'lo', LUC);
    expect(await demTrongNgay(kho, NGAY)).toEqual({ ngay: NGAY, lo: 2, ket: 1 });
  });

  it('⭐ SANG NGÀY MỚI thì bộ đếm về 0 — và "ngày" do NGƯỜI GỌI đưa', async () => {
    // "Ngày" của PFM theo giờ user (K7), không theo UTC và không theo đồng hồ của file
    // này. Tự đọc đồng hồ ở đây là làm cả trần lệch cho người ở múi giờ khác.
    for (let i = 0; i < 5; i++) await ghiNhanGui(kho, NGAY, 'lo', LUC);
    expect((await demTrongNgay(kho, NGAY)).lo).toBe(5);
    expect((await demTrongNgay(kho, '2026-09-01')).lo).toBe(0);
  });

  it('hết lượt thì nói KHÔNG — lô và két đếm riêng', async () => {
    for (let i = 0; i < PFM_LO.LO_MOI_NGAY; i++) await ghiNhanGui(kho, NGAY, 'lo', LUC);
    expect(await conLuotLo(kho, NGAY)).toBe(false);
    expect(await conLuotKet(kho, NGAY), 'két chưa đụng lượt nào').toBe(true);

    for (let i = 0; i < PFM.SO_LAN_LUU_NGAY; i++) await ghiNhanGui(kho, NGAY, 'ket', LUC);
    expect(await conLuotKet(kho, NGAY)).toBe(false);
  });

  it('trần két là 2 lần/ngày (rời app + dự phòng), không phải 6 như bản đầu', () => {
    // D146 K11: 6 lần/ngày là dòng chi lớn nhất của PFM trong ngân sách 1M lượt gọi.
    expect(PFM.SO_LAN_LUU_NGAY).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — RÀNG BUỘC CẤU TRÚC
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§VI — RA DÂY (D257/GĐ1): hai đầu dây phải thật sự chạm nhau', () => {
  /*
   * ⚠⚠ ĐÂY LÀ BÀI TEST ĐÁNG LẼ PHẢI CÓ TỪ ĐẦU. Trước D251, client gom lô theo hình của
   * nó và server nhận theo hình của nó — mỗi bên tự nhất quán, mỗi bên có test xanh, và
   * **không bao giờ nối được**. Bảy endpoint PFM sống suốt hai đợt mà không một client
   * nào gọi; cái sai chỉ lộ ra khi ai đó thử nối (R8).
   * ⇒ `kiemPhongBiMon` là CHÍNH cửa kiểm server chạy trên mỗi món. Gọi thẳng nó ở đây,
   * trên bản `raWire` sinh ra, là cách rẻ nhất chứng minh hai hình khớp — không cần
   * dựng server, và đỏ ngay lúc ai đó đổi một bên mà quên bên kia.
   */
  it('⭐⭐⭐ NHỊP ra dây ⇒ QUA được cửa kiểm của server', () => {
    const m = nhip('pfm_hu');
    const id = khoaMon(m, 'abc123');
    const w = raWire(m, id);
    expect(w).toEqual({ id: 'nhip:abc123', loai: 'nhip', ma: 'pfm_hu', v: { hu_id: 'h1' } });
    // `pfm_hu` đòi cả `hu_id` lẫn `ma` (K5) — nhịp mẫu ở trên thiếu `ma`, nên bổ vào.
    const wDu = { ...w, v: { hu_id: 'h1', ma: 'tao' } };
    expect(kiemPhongBiMon(wDu), 'server phải nhận đúng hình client gửi').toBeNull();
  });

  it('⭐⭐⭐ GÓI ra dây ⇒ QUA được cửa kiểm của server', () => {
    const m = goi('2026-08');
    const id = khoaMon(m, 'khong-dung');
    const w = raWire(m, id);
    expect(w).toMatchObject({ id: 'goi:2026-08', loai: 'goi', ky: '2026-08' });
    expect(kiemPhongBiMon(w), 'server phải nhận đúng hình client gửi').toBeNull();
  });

  it('⭐ `id` trên dây CHÍNH LÀ khoá hàng đợi — không phải id mới sinh', () => {
    /*
     * Server dùng `id` làm khoá chống trùng cấp món (migration 0056), và khoá ấy chỉ có
     * tác dụng nếu nó ỔN ĐỊNH qua các lần gửi lại. Sinh id mới mỗi lần gửi là vô hiệu
     * hoá cả bảng chống trùng, im lặng.
     */
    const m = nhip('pfm_hu');
    const id = khoaMon(m, 'xyz');
    expect(raWire(m, id).id).toBe(id);
    expect(raWire(m, khoaMon(m, 'xyz')).id, 'gửi lại phải ra ĐÚNG id cũ').toBe(id);
  });

  it('⭐ camelCase → snake_case, và `doi_tuong` VẮNG khi không có', () => {
    const m: MonHangDoi = {
      loai: 'goi', ky: '2026-08',
      goi: { ky: '2026-08', schemaVersion: SCHEMA_VERSION, dong: [
        { ma: 'hv_chi_bu' as MaDacTrung, giaTri: 0.25 },
        { ma: 'y_loai' as MaDacTrung, giaTri: 'giao_duc', doiTuong: 'hu_1' },
      ] },
    };
    const w = raWire(m, 'goi:2026-08');
    if (w.loai !== 'goi') throw new Error('phải là gói');
    expect(w.schema_v).toBe(SCHEMA_VERSION);
    expect(w.dong[0]).toEqual({ ma: 'hv_chi_bu', gia_tri: 0.25 });
    expect('doi_tuong' in w.dong[0]!, 'không có đối tượng ⇒ KHÔNG được có khoá').toBe(false);
    expect(w.dong[1]).toEqual({ ma: 'y_loai', gia_tri: 'giao_duc', doi_tuong: 'hu_1' });
  });

  it('⭐ layLo đếm byte trên HÌNH ĐI LÊN DÂY, không phải hình trong máy', async () => {
    /*
     * Hai hình khác nhau (`id` thêm vào, khoá đổi tên) nên bản trên dây LỚN HƠN. Đo bản
     * trong máy là đo một thứ không ai gửi, mà trần `content-length` của server áp lên
     * bản thật ⇒ lô bị 413.
     */
    const kho = new KhoTrongBoNho();
    const m = goi('2026-08');
    await xepHang(kho, m, LUC, 'r1', THANG);
    const lo = await layLo(kho);
    expect(lo.than).toHaveLength(1);
    const tren = JSON.stringify(lo.than).length;
    const trongMay = JSON.stringify(lo.mon).length;
    /*
     * ⚠ Bản trên dây hoá ra NHỎ HƠN bản trong máy, không lớn hơn như tôi đoán: hình
     * trong máy lồng `goi:{ky, schemaVersion, dong}` nên lặp `ky` và dùng tên dài, còn
     * dây thì phẳng + `schema_v`. Phần dẹt tiết kiệm nhiều hơn phần `id` thêm vào.
     * ⇒ Chiều không quan trọng; điều phải ghim là `byte` bám bản NÀO. Sai chiều nào
     * cũng hỏng: đo thiếu thì 413, đo thừa thì lô nhỏ hơn cần thiết.
     */
    expect(tren, 'hai hình phải thật sự khác cỡ, không thì bài này rỗng').not.toBe(trongMay);
    expect(Math.abs(lo.byte - tren), '`byte` phải bám bản TRÊN DÂY').toBeLessThanOrEqual(2);
    expect(Math.abs(lo.byte - trongMay), 'và KHÔNG bám bản trong máy').toBeGreaterThan(2);
  });

  it('⭐ layLo cắt theo TRẦN DÒNG của cả lô, không chỉ trần món', async () => {
    /*
     * Server đếm y hệt (`PFM_LO.DONG_MOI_LO`). Không cắt ở client thì lô đi lên rồi ăn
     * 400 NGUYÊN KHỐI — mà 400 là lỗi tất định nên client bỏ sạch cả lô theo giao ước
     * `XAC_NHAN_BO_HET`. Mất dữ liệu vì một phép đếm.
     */
    const kho = new KhoTrongBoNho();
    /*
     * ⚠ Phải BA gói mới vượt: `DONG_MOI_GOI` (300) × 2 = 600 = đúng bằng `DONG_MOI_LO`,
     * nên hai gói đầy KHÔNG bao giờ chạm trần. Bản đầu tôi để hai gói và bài xanh giả.
     */
    const moiGoi = Math.ceil(PFM_LO.DONG_MOI_LO / 2.4);   // 3 gói là vượt, 2 gói thì chưa
    const dungGoi = (ky: string): MonHangDoi => ({
      loai: 'goi', ky,
      goi: { ky, schemaVersion: SCHEMA_VERSION, dong: Array.from({ length: moiGoi },
        () => ({ ma: 'hv_chi_bu' as MaDacTrung, giaTri: 0.25 })) },
    });
    await xepHang(kho, dungGoi('2026-06'), LUC, 'a', '2026-06');
    await xepHang(kho, dungGoi('2026-07'), LUC, 'b', '2026-07');
    await xepHang(kho, dungGoi('2026-08'), LUC, 'c', '2026-08');
    expect(moiGoi * 3, 'ba gói phải VƯỢT trần').toBeGreaterThan(PFM_LO.DONG_MOI_LO);
    expect(moiGoi * 2, 'nhưng hai gói thì chưa').toBeLessThanOrEqual(PFM_LO.DONG_MOI_LO);

    const lo = await layLo(kho);
    expect(lo.ids, 'phải cắt lại gói thứ ba').toHaveLength(2);
    expect(lo.conNua).toBe(true);
  });

  it('món ĐƠN LẺ vượt trần dòng vẫn đi (lô một món) — không để hàng đợi tắc vĩnh viễn', async () => {
    const kho = new KhoTrongBoNho();
    const to: MonHangDoi = {
      loai: 'goi', ky: '2026-08',
      goi: { ky: '2026-08', schemaVersion: SCHEMA_VERSION,
        dong: Array.from({ length: PFM_LO.DONG_MOI_LO + 10 },
          () => ({ ma: 'hv_chi_bu' as MaDacTrung, giaTri: 0.25 })) },
    };
    await xepHang(kho, to, LUC, 'a', THANG);
    expect((await layLo(kho)).ids, 'giữ lại là để tắc mãi mãi').toHaveLength(1);
  });
});

describe('§V — ràng buộc cấu trúc', () => {
  const nguon = fs.readFileSync(path.resolve(__dirname, '../src/pfm/dong_bo.ts'), 'utf8');
  const ma = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('⭐ KHÔNG mượn phần "đầy thì vứt cái cũ nhất" của telemetry', () => {
    /*
     * Telemetry được phép mất dòng (A9 — giá trị ở XU HƯỚNG); nhịp PFM đi vào `events`
     * append-only thì không. Một hàng đợi tự vứt là cách mất dữ liệu êm ái nhất tồn tại:
     * không lỗi, không log, chỉ là vài dòng không bao giờ tới.
     */
    expect(ma).not.toContain('shift(');
    expect(ma).not.toContain('splice(');
    // đường bỏ món DUY NHẤT là `xacNhanGui`, và nó chỉ chạy sau khi server nhận
    const soLanXoa = [...ma.matchAll(/kho\.xoaHan\(/g)].length;
    expect(soLanXoa, 'chỉ một chỗ được phép bỏ món').toBe(1);
  });

  it('không tự gọi mạng — việc gửi là của người gọi', () => {
    expect(ma).not.toContain('fetch(');
    expect(ma).not.toContain('XMLHttpRequest');
  });

  it('không đọc đồng hồ', () => {
    expect(ma).not.toContain('Date.now(');
    expect(ma).not.toMatch(/new Date\(/);
  });

  it('⭐ `outbox` KHÔNG vào két — nếu vào thì khôi phục là gửi lại thứ đã gửi', () => {
    // Ràng buộc này sống ở `ket.ts` nhưng ĐỒNG BỘ mới là bên phụ thuộc vào nó: `xoaHan`
    // (không bia mộ) chỉ đúng vì hàng đợi không bao giờ được chở đi đâu.
    expect(KIEU_LAT.outbox).toBe('khong');
  });
});
