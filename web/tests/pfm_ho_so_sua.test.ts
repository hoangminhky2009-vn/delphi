/**
 * PFM — `suaHoSo` (`pfm/ho_so.ts` §2b, D360): đọc–sửa–ghi hồ sơ, XẾP HÀNG theo từng kho.
 *
 * ⚠⚠ VÌ SAO TỆP NÀY TỒN TẠI RIÊNG. `ghiHoSo` ghi đè TRỌN bản ghi, nên mọi người gọi nó phải tự cầm một bản ĐỦ của
 * hồ sơ — và thứ các màn cầm là state React (`{}` khi chưa nạp xong, bản CŨ giữa hai lượt nạp). Màn LỘ TRÌNH lên
 * prod từ 0.0.5 với đúng thế ấy. `suaHoSo` là cửa sửa-một-phần duy nhất: người gọi đưa PHÉP SỬA, không đưa hồ sơ.
 *
 * Bài đắt nhất ở đây là §II: hai phép sửa phát ra trong cùng một nhịp. Đọc-lại-từ-kho một mình KHÔNG qua được nó —
 * cả hai cùng đọc trước khi cái nào kịp ghi — nên nó là bài duy nhất phân biệt "đọc lại" với "xếp hàng".
 * Bài ở tầng MÀN (hai cú chạm thật trên nút): `lo_trinh_nut.test.tsx` §VI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { ID_HO_SO, LoiHoSo, docHoSo, ghiHoSo, suaHoSo, type HoSo } from '../src/pfm/ho_so.js';

const LUC = '2026-09-20T09:00:00.000Z';
const LUC_SAU = '2026-09-21T09:00:00.000Z';

async function khoVoi(h: HoSo): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  await ghiHoSo(kho, h, LUC);
  return kho;
}

describe('I. Đọc–sửa–ghi: phép sửa chạy trên bản ĐANG NẰM TRONG KHO', () => {
  it('chỉ khoá được sửa đổi; mọi khoá khác của kho còn nguyên', async () => {
    const DAY: HoSo = {
      nguonThu: 'luong', khung: 'kakeibo', coNo: true, deu: 'thất thường', mucTieu: ['chuyến đi'],
      nhip: ['ngày tệ'], nguonThuNhan: ['lương tháng'], coNoNhan: ['trả góp'], chanDungBac: ['nhip'],
      chanDungDaCham: ['nhip'], chanDungNhip: 'cuối tháng', ngayDauBo: [2],
    };
    const kho = await khoVoi(DAY);
    const ra = await suaHoSo(kho, (cu) => ({ ...cu, loTrinhBo: ['chuyến đi'] }), LUC_SAU);
    expect(ra).toEqual({ ...DAY, loTrinhBo: ['chuyến đi'] });
    expect(await docHoSo(kho)).toEqual({ ...DAY, loTrinhBo: ['chuyến đi'] });
  });

  it('kho CHƯA từng có hồ sơ ⇒ `f` nhận `{}`, và bản ghi được tạo', async () => {
    const kho = new KhoTrongBoNho();
    await suaHoSo(kho, (cu) => { expect(cu).toEqual({}); return { ...cu, khung: 'hu' }; }, LUC);
    expect(await docHoSo(kho)).toEqual({ khung: 'hu' });
  });

  it('⭐ `f` trả `null` ⇒ KHÔNG ghi: mốc sửa của bản ghi không nhích', async () => {
    // Ghi lại một bản y hệt là nhích `suaLuc` — mà `suaLuc` là thứ phép hoà giải của két đọc để biết bản nào mới hơn.
    const kho = await khoVoi({ loTrinhBo: ['chuyến đi'] });
    const ra = await suaHoSo(kho, () => null, LUC_SAU);
    expect(ra).toBeNull();
    expect((await kho.doc<HoSo>('meta', ID_HO_SO))!.suaLuc).toBe(LUC);
  });
});

describe('II. ⭐⭐⭐ XẾP HÀNG — hai phép sửa sát nhau không nuốt nhau', () => {
  it('hai lượt phát ra trong CÙNG một nhịp ⇒ lượt sau đọc bản lượt trước ĐÃ GHI', async () => {
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng', 'chuyến đi'] });
    // KHÔNG `await` giữa hai lời gọi: đây là mô hình tất định của "chạm nhanh hơn một lượt đọc–ghi IndexedDB".
    const a = suaHoSo(kho, (cu) => ({ ...cu, loTrinhBo: [...(cu.loTrinhBo ?? []), 'quỹ dự phòng'] }), LUC_SAU);
    const b = suaHoSo(kho, (cu) => ({ ...cu, loTrinhBo: [...(cu.loTrinhBo ?? []), 'chuyến đi'] }), LUC_SAU);
    await Promise.all([a, b]);
    expect(await docHoSo(kho)).toEqual({
      mucTieu: ['quỹ dự phòng', 'chuyến đi'], loTrinhBo: ['quỹ dự phòng', 'chuyến đi'],
    });
  });

  it('mười lượt đồng thời, mỗi lượt thêm MỘT khoá ⇒ đủ mười, đúng thứ tự phát', async () => {
    const kho = new KhoTrongBoNho();
    await Promise.all(Array.from({ length: 10 }, (_, i) => suaHoSo(
      kho, (cu) => ({ ...cu, loTrinhBo: [...(cu.loTrinhBo ?? []), `k${i}`] }), LUC,
    )));
    expect((await docHoSo(kho)).loTrinhBo).toEqual(Array.from({ length: 10 }, (_, i) => `k${i}`));
  });

  it('⭐ kho CHẬM, GHI chậm hơn ĐỌC (đúng dáng IndexedDB) — lượt sau chỉ bắt đầu đọc SAU KHI lượt trước GHI XONG', async () => {
    /*
     * `KhoTrongBoNho` đọc/ghi Map ngay lúc gọi, nên hai bài trên chưa loại được một bản xếp hàng "NỬA VỜI" — lượt
     * sau chỉ chờ lượt trước ĐỌC xong, không chờ GHI xong. Ở đây mỗi lượt bị giữ lại bằng đồng hồ và ta ghi vết CẢ
     * ĐẦU LẪN CUỐI từng lượt: phải là đọc→ghi→đọc→ghi TRỌN VẸN, không lượt đọc nào chen vào giữa một lượt ghi.
     * ⚠⚠ BẢN ĐẦU CỦA BÀI NÀY LÀ MỘT BÀI CANH RỖNG (tiêm lỗi D360, mũi M14 — XANH): nó chỉ ghi vết lúc GỌI và để
     * đọc/ghi cùng trễ 5 ms. Bản nửa vời vẫn ra đúng dãy `doc,ghi,doc,ghi` (vết lúc gọi không phân biệt được), và
     * trạng thái cuối vẫn đúng vì đồng hồ FIFO cho lượt ghi của A nổ trước lượt đọc của B. GHI phải CHẬM HƠN ĐỌC
     * thì cửa sổ mất-cập-nhật mới mở ra — và ngoài đời đúng là thế.
     */
    const kho = await khoVoi({});
    const vet: string[] = [];
    const docGoc = kho.doc.bind(kho);
    const ghiGoc = kho.ghi.bind(kho);
    const cho = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    (kho as unknown as { doc: typeof kho.doc }).doc = (async (ngan: never, id: never) => {
      vet.push('doc>'); await cho(2); const b = await docGoc(ngan, id); vet.push('doc<'); return b;
    }) as typeof kho.doc;
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async (ngan: never, b: never) => {
      vet.push('ghi>'); await cho(25); await ghiGoc(ngan, b); vet.push('ghi<');
    }) as typeof kho.ghi;
    await Promise.all([
      suaHoSo(kho, (cu) => ({ ...cu, khung: 'hu' }), LUC_SAU),
      suaHoSo(kho, (cu) => ({ ...cu, loTrinhBo: ['chuyến đi'] }), LUC_SAU),
    ]);
    expect(vet).toEqual(['doc>', 'doc<', 'ghi>', 'ghi<', 'doc>', 'doc<', 'ghi>', 'ghi<']);
    // Gỡ lớp giữ chậm rồi mới đọc kết quả — để phép đọc kiểm không lẫn vào vết.
    (kho as unknown as { doc: typeof kho.doc }).doc = docGoc;
    expect(await docHoSo(kho)).toEqual({ khung: 'hu', loTrinhBo: ['chuyến đi'] });
  });

  it('hai KHO khác nhau không chờ nhau — hàng đợi là của TỪNG kho', async () => {
    const treo = new KhoTrongBoNho();
    const kia = new KhoTrongBoNho();
    // Kho `treo` không bao giờ đọc xong: nếu hàng đợi dùng chung thì lượt của kho `kia` cũng đứng theo.
    (treo as unknown as { doc: typeof treo.doc }).doc = (() => new Promise(() => undefined)) as typeof treo.doc;
    void suaHoSo(treo, (cu) => ({ ...cu, khung: 'hu' }), LUC);
    await suaHoSo(kia, (cu) => ({ ...cu, khung: 'kakeibo' }), LUC);
    expect(await docHoSo(kia)).toEqual({ khung: 'kakeibo' });
  });
});

describe('III. ⭐⭐ Lượt HỎNG không kéo sập hàng đợi, và không hỏng im lặng', () => {
  it('lượt ném lỗi ⇒ người gọi CỦA LƯỢT ẤY nhận lỗi; lượt sau vẫn chạy trên bản sạch', async () => {
    const kho = await khoVoi({ deu: 'thất thường' });
    const hong = suaHoSo(kho, (cu) => ({ ...cu, khung: 'khong-co-that' as never }), LUC_SAU);
    const lanh = suaHoSo(kho, (cu) => ({ ...cu, khung: 'hu' }), LUC_SAU);
    await expect(hong, 'giá trị ngoài miền là lỗi lập trình — phải NỔ ở người gọi, không được nuốt').rejects.toBeInstanceOf(LoiHoSo);
    await expect(lanh).resolves.toEqual({ deu: 'thất thường', khung: 'hu' });
    expect(await docHoSo(kho)).toEqual({ deu: 'thất thường', khung: 'hu' });
  });

  it('⭐ kho ĐỌC HỎNG ⇒ ném về người gọi và KHÔNG ghi gì — không có bản để sửa thì không được dựng bản mới từ `{}`', async () => {
    // Đây là lớp bảo vệ cuối khi một màn lỡ vẽ nút trên hồ sơ rỗng (lượt đọc của màn hỏng): cú ghi vẫn không đè được kho.
    const kho = await khoVoi({ deu: 'thất thường', mucTieu: ['chuyến đi'] });
    const banGoc = await kho.doc<HoSo>('meta', ID_HO_SO);
    const docGoc = kho.doc.bind(kho);
    let soLanGhi = 0;
    const ghiGoc = kho.ghi.bind(kho);
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async (ngan: never, b: never) => { soLanGhi++; return ghiGoc(ngan, b); }) as typeof kho.ghi;
    (kho as unknown as { doc: typeof kho.doc }).doc = (async () => { throw new Error('đọc hỏng'); }) as typeof kho.doc;

    await expect(suaHoSo(kho, (cu) => ({ ...cu, loTrinhBo: ['chuyến đi'] }), LUC_SAU)).rejects.toThrow('đọc hỏng');
    expect(soLanGhi).toBe(0);
    expect(await docGoc<HoSo>('meta', ID_HO_SO)).toEqual(banGoc);
  });

  it('`f` tự ném ⇒ cũng thế: lỗi về đúng người gọi, hàng đợi đi tiếp, kho không bị đụng', async () => {
    const kho = await khoVoi({ deu: 'thất thường' });
    const hong = suaHoSo(kho, () => { throw new Error('phép sửa hỏng'); }, LUC_SAU);
    const lanh = suaHoSo(kho, (cu) => ({ ...cu, coNo: false }), LUC_SAU);
    await expect(hong).rejects.toThrow('phép sửa hỏng');
    await lanh;
    expect(await docHoSo(kho)).toEqual({ deu: 'thất thường', coNo: false });
  });
});

describe('IV. ⭐⭐ CANH CẢ LỚP — không màn nào được tự ghi đè hồ sơ nữa', () => {
  /*
   * Ba màn (LỘ TRÌNH · NGÀY ĐẦU · PHỎNG VẤN) từng mỗi màn một bản "dựng hồ sơ rồi `ghiHoSo`", và cả ba đều dính cùng
   * một họ lỗi (D358 · D360). Vá từng màn thì màn thứ tư sẽ dính lại — nên bài này đọc CHÍNH MÃ NGUỒN: ngoài
   * `pfm/ho_so.ts` không tệp nào trong `src/` được gọi `ghiHoSo(`. Muốn sửa hồ sơ thì đưa PHÉP SỬA cho `suaHoSo`.
   * ⚠ Bóc chú thích TRƯỚC khi quét (bài học D87/D116): `phong_van.ts` nhắc tên `ghiHoSo` trong lời giải thích, và
   *   một bài báo động giả là một bài sẽ bị tắt đi.
   */
  const bocChuThich = (ma: string): string => ma.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  function quet(thuMuc: string, ra: string[] = []): string[] {
    for (const ten of readdirSync(join(process.cwd(), thuMuc))) {
      const p = `${thuMuc}/${ten}`;
      if (statSync(join(process.cwd(), p)).isDirectory()) quet(p, ra);
      else if (/\.tsx?$/.test(ten)) ra.push(p);
    }
    return ra;
  }

  it('ngoài `pfm/ho_so.ts`, không tệp nào trong `src/` gọi `ghiHoSo(`', () => {
    const tep = quet('src');
    expect(tep.length, 'bộ quét không thấy tệp nào ⇒ bài đang xanh rỗng').toBeGreaterThan(100);
    const pham = tep
      .filter((p) => p !== 'src/pfm/ho_so.ts')
      .filter((p) => /\bghiHoSo\s*\(/.test(bocChuThich(readFileSync(join(process.cwd(), p), 'utf8'))));
    expect(pham, 'ghi đè TRỌN hồ sơ từ ngoài `ho_so.ts` — đưa phép sửa cho `suaHoSo` thay vì tự dựng bản ghi').toEqual([]);
  });

  it('⭐ không màn PFM nào GÕ TAY câu báo lỗi ghi — chữ phải về `CHU_LOI_GHI` (A11.5)', () => {
    /*
     * Trước D360 mỗi màn một câu gõ tay ('Chưa lưu được, thử lại nhé.' ở PHỎNG VẤN, câu khác ở CAM KẾT) và hai màn
     * thì CÂM. Bản sao thứ hai của một câu chữ SẼ trôi — đến ngày sửa câu cho đúng A10 thì chỉ sửa được một chỗ.
     * ⚠ Cấm theo HÌNH DẠNG (`setLoi…(` nhận một chuỗi literal), không cấm theo nội dung câu: cấm nội dung thì gõ
     *   một câu khác là lọt, mà "gõ một câu khác" chính là cái đang đi chặn.
     */
    const man = quet('src/screens/tai-chinh').concat(quet('src/components/pfm'));

    const pham = man.filter((p) => /setLoi\w*\(\s*['"`]/.test(bocChuThich(readFileSync(join(process.cwd(), p), 'utf8'))));
    expect(pham, 'câu báo lỗi gõ tay — dùng `CHU_LOI_GHI` (hoặc một khoá trong `pfm_chu.ts`)').toEqual([]);
  });

  it('và bộ quét THẬT SỰ bắt được một lời gọi — không xanh vì mù', () => {
    expect(/\bghiHoSo\s*\(/.test(bocChuThich('await ghi([m], (kho) => ghiHoSo(kho, moi, luc)); // ghi'))).toBe(true);
    expect(/\bghiHoSo\s*\(/.test(bocChuThich('/* ghiHoSo(kho, x) */ const a = 1; // ghiHoSo(kho, y)'))).toBe(false);
  });
});
