/**
 * PFM NGÀY ĐẦU — `pfm/chan_dung.ts` (GIAI ĐOẠN A, D355/D356): nhóm nguồn thu · chân
 * dung · ba việc · thanh "mức độ hiểu bạn". Vector CHÉP TAY theo demo đã chốt
 * (`docs/ui-ux/demo/pfm-ngay-dau.html`) + bảng §2 của
 * `docs/thiet-ke-de-xuat/pfm-hanh-vi/tien-nghiem-tu-thong-ke-ngoai.md` (D353).
 *
 * ⚠ Bài đắt nhất ở đây là §V: BA TRƯỜNG MỚI CỦA HỒ SƠ (`chanDungBac`/`chanDungNhip`/
 * `ngayDauBo`) KHÔNG ĐƯỢC LỌT VÀO GÓI ĐẶC TRƯNG — canh cả bằng hành vi (`ctxCuaHoSo`)
 * lẫn bằng mã nguồn (grep tĩnh `dac_trung.ts`/`dong_bo*.ts`), vì đây đúng là loại lỗi
 * "không có gì đỏ" mà A8.2 lo: một trục nghiên cứu agent tự đặt rời máy trong im lặng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MA_CHAN_DUNG, baViec, chanDung, mucDoHieu, nhomNguonThu, soNetDaTuongTac,
  soNgayCoGhi, soViecDaLamHoacBo, type TrangThaiBaViec, type ViecNgayDau,
  donDauVetSauPhongVan, hoanTacNetTrenHoSo,
} from '../src/pfm/chan_dung.js';
import { CHAN_DUNG_NOI_DUNG } from '../src/lib/pfm_chu.js';
import { O_CHU_TOI_DA } from '../src/lib/pfm_chu.js';
import { ctxCuaHoSo, type HoSo } from '../src/pfm/ho_so.js';
import { MAU_LUAT } from '../src/pfm/mau_luat.js';
import { canNguong } from '../src/pfm/luat.js';
import { ROUTE_TAI_CHINH_CAM_KET, ROUTE_TAI_CHINH_HU, ROUTE_TAI_CHINH_SO } from '../src/lib/vocab.js';
import type { Khoan } from '../src/pfm/so.js';

const TT_RONG: TrangThaiBaViec = { coHuDangMo: false, coLuat: false, coGhiSo: false };

function khoan(ngay: string, id = ngay): Khoan {
  return {
    id, ngay, soTien: 20_000, chieu: 'chi', nhan: null, huId: null, cachGhi: 'tay',
    viSale: null, taoLuc: `${ngay}T08:00:00.000Z`, suaLuc: `${ngay}T08:00:00.000Z`,
  };
}

describe('§I — nhomNguonThu: bốn nhóm + null, bảng D353 §2', () => {
  it('CHU CẤP — gia đình cho/học bổng, không lương, không tự kiếm', () => {
    expect(nhomNguonThu({ nguonThuNhan: ['gia đình cho'] })).toBe('chu_cap');
    expect(nhomNguonThu({ nguonThuNhan: ['học bổng'] })).toBe('chu_cap');
    expect(nhomNguonThu({ nguonThuNhan: ['gia đình cho', 'học bổng'] })).toBe('chu_cap');
  });

  it('CHU CẤP + TỰ KIẾM — có gia đình cho VÀ một trong làm thêm/bán hàng/lương tháng', () => {
    expect(nhomNguonThu({ nguonThuNhan: ['gia đình cho', 'làm thêm'] })).toBe('chu_cap_tu_kiem');
    expect(nhomNguonThu({ nguonThuNhan: ['gia đình cho', 'bán hàng'] })).toBe('chu_cap_tu_kiem');
    expect(nhomNguonThu({ nguonThuNhan: ['gia đình cho', 'lương tháng'] })).toBe('chu_cap_tu_kiem');
  });

  it('LƯƠNG — có lương tháng, không gia đình cho', () => {
    expect(nhomNguonThu({ nguonThuNhan: ['lương tháng'] })).toBe('luong');
  });

  it('TỰ KIẾM — có làm thêm/bán hàng, không lương, không gia đình cho', () => {
    expect(nhomNguonThu({ nguonThuNhan: ['làm thêm'] })).toBe('tu_kiem');
    expect(nhomNguonThu({ nguonThuNhan: ['bán hàng'] })).toBe('tu_kiem');
  });

  it('⭐ KHÔNG khớp hàng nào ⇒ null (bỏ câu 1, hoặc chỉ chọn "đầu tư")', () => {
    expect(nhomNguonThu({})).toBeNull();
    expect(nhomNguonThu({ nguonThuNhan: [] })).toBeNull();
    expect(nhomNguonThu({ nguonThuNhan: ['đầu tư'] })).toBeNull();
  });

  it('⭐⭐ đọc trên NHÃN THÔ (nguonThuNhan), không phải mã đã đúc (nguonThu)', () => {
    // hoSo.nguonThu (mã đã đúc) không tồn tại trong chữ ký hàm — tự nó đã là bài canh
    // kiểu: đưa vào một hồ sơ có nguonThuNhan mơ hồ (2 nhóm) vẫn phải suy được một nhóm
    // ở ĐÂY dù `nguonThuTuNhan` (phong_van.ts) để trống mã ctx_nguon_thu cho đúng hồ sơ đó.
    const h: HoSo = { nguonThuNhan: ['lương tháng', 'gia đình cho'] };
    expect(nhomNguonThu(h)).toBe('chu_cap_tu_kiem');
  });
});

describe('§II — chanDung: năm mã, suy từ chip ĐẦU TIÊN của câu 6, có override', () => {
  it('bốn chip câu 6 ⇒ đúng bốn mã (NGUYÊN VĂN demo CHAN_DUNG)', () => {
    expect(chanDung({ nhip: ['ngay sau khi tiền về'] })).toBe('tien_ve');
    expect(chanDung({ nhip: ['cuối tháng'] })).toBe('cuoi_thang');
    expect(chanDung({ nhip: ['ngày tệ'] })).toBe('ngay_te');
    expect(chanDung({ nhip: ['đi chơi cùng bạn'] })).toBe('ban_ru');
  });

  it('⭐ bỏ qua câu 6 (hoặc chip lạ) ⇒ chua_ro, KHÔNG đoán (P7)', () => {
    expect(chanDung({})).toBe('chua_ro');
    expect(chanDung({ nhip: [] })).toBe('chua_ro');
    expect(chanDung({ nhip: ['nhãn không tồn tại'] })).toBe('chua_ro');
  });

  it('nhiều chip ⇒ CHỈ chip đầu tiên quyết định (chip sau bị bỏ qua)', () => {
    expect(chanDung({ nhip: ['ngày tệ', 'đi chơi cùng bạn'] })).toBe('ngay_te');
  });

  it('⭐⭐ chanDungNhip (A2, người dùng tự chọn lại) THẮNG chip gốc của câu 6', () => {
    expect(chanDung({ nhip: ['ngày tệ'], chanDungNhip: 'đi chơi cùng bạn' })).toBe('ban_ru');
  });
});

describe('§III — baViec: hũ · luật · ghi, XONG suy từ TRẠNG THÁI THẬT', () => {
  it('không nợ ⇒ hũ theo mauHopVoiHoSo mặc định (không viết lại luật đó — D61)', () => {
    const [hu] = baViec({}, TT_RONG);
    expect(hu.mau.id).toBe('du_phong');
    expect(hu.coNo).toBe(false);
    expect(hu.route).toBe(ROUTE_TAI_CHINH_HU);
  });

  it('⭐⭐ có nợ (coNo) ⇒ hũ TRẢ NỢ đứng trước — DÙNG LẠI mauHopVoiHoSo, không đoán lại', () => {
    const [hu] = baViec({ coNo: true }, TT_RONG);
    expect(hu.mau.id).toBe('tra_no');
    expect(hu.coNo).toBe(true);
  });

  it('tuLap phụ thuộc gia đình (không nợ) ⇒ vẫn đúng thứ tự của mauHopVoiHoSo', () => {
    const [hu] = baViec({ tuLap: 'phu_thuoc' }, TT_RONG);
    expect(hu.mau.id).toBe('thiet_bi_hoc');
  });

  it('⭐⭐ luật gợi theo chip câu 6 — ba nhãn ra ba mẫu khác nhau, đúng canNguong', () => {
    const [, tienVe] = baViec({ nhip: ['ngay sau khi tiền về'] }, TT_RONG);
    expect(tienVe.mau.id).toBe('tien_moi_ve');
    expect(tienVe.dieuKien).toBe('tien_vua_ve');
    expect(tienVe.haiCham).toBe(false);
    expect(tienVe.route).toBe(`${ROUTE_TAI_CHINH_CAM_KET}?dk=tien_vua_ve`);

    const [, ngayDam] = baViec({ nhip: ['cuối tháng'] }, TT_RONG);
    expect(ngayDam.mau.id).toBe('ngay_dat');
    expect(ngayDam.dieuKien).toBe('ngay_chi_lon');

    const [, khoanLon] = baViec({ nhip: ['đi chơi cùng bạn'] }, TT_RONG);
    expect(khoanLon.mau.id).toBe('khoan_to');
    expect(khoanLon.dieuKien).toBe('khoan_vuot_muc');
    // ⭐ điều kiện khoan_vuot_muc ⇒ hai chạm (canNguong thật, không hardcode lại).
    expect(khoanLon.haiCham).toBe(true);
    expect(khoanLon.haiCham).toBe(canNguong('khoan_vuot_muc'));
  });

  it('⭐ chưa rõ chip (bỏ câu 6) ⇒ mẫu ĐẦU TIÊN của MAU_LUAT làm khởi điểm trung tính', () => {
    const [, luat] = baViec({}, TT_RONG);
    expect(luat.mau.id).toBe(MAU_LUAT[0]!.id);
    expect(luat.dieuKien).toBe(MAU_LUAT[0]!.dieuKien);
  });

  it('⭐⭐ chanDungNhip (override) cũng lái gợi ý luật — chân dung và việc 2 kể CÙNG một chip', () => {
    const [, luat] = baViec({ nhip: ['ngày tệ'], chanDungNhip: 'đi chơi cùng bạn' }, TT_RONG);
    expect(luat.mau.id).toBe('khoan_to');
  });

  it('ghi luôn trỏ về SỔ, không mẫu nào để chọn', () => {
    const [, , ghi] = baViec({}, TT_RONG);
    expect(ghi.route).toBe(ROUTE_TAI_CHINH_SO);
  });

  it('⭐⭐⭐ XONG suy từ TRẠNG THÁI THẬT, không lưu cờ "đã làm"', () => {
    const [hu, luat, ghi] = baViec({}, { coHuDangMo: true, coLuat: true, coGhiSo: true });
    expect(hu.trangThai).toBe('xong');
    expect(luat.trangThai).toBe('xong');
    expect(ghi.trangThai).toBe('xong');
  });

  it('⭐⭐ BỎ lưu vào hồ sơ (ngayDauBo) — chỉ số 0/1/2', () => {
    const [hu, luat, ghi] = baViec({ ngayDauBo: [0, 2] }, TT_RONG);
    expect(hu.trangThai).toBe('bo');
    expect(luat.trangThai).toBe('chua');
    expect(ghi.trangThai).toBe('bo');
  });

  it('⭐⭐⭐ TRẠNG THÁI THẬT THẮNG cờ đã bỏ cũ (A11.21 — mốc là điều làm được)', () => {
    const [hu] = baViec({ ngayDauBo: [0] }, { ...TT_RONG, coHuDangMo: true });
    expect(hu.trangThai, 'đã tự mở hũ thật thì phải là XONG, không kẹt ở BỎ').toBe('xong');
  });
});

describe('§IV — mucDoHieu: 0..100 + ba mốc, TÍNH CHẤT PHẢI GIỮ (D356)', () => {
  it('trả lời hết (9/9, mẫu số hôm nay) ⇒ 22 điểm', () => {
    expect(mucDoHieu({
      soCauDaTraLoi: 9, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: 0,
    }).phanTram).toBe(22);
  });

  it('⭐⭐ thiếu câu thì CHIA ĐỀU theo số đã trả lời / soCauToiDa, LÀM TRÒN XUỐNG', () => {
    const diem = (n: number) => mucDoHieu({
      soCauDaTraLoi: n, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: 0,
    }).phanTram;
    expect(diem(0)).toBe(0);
    expect(diem(1)).toBe(Math.floor(22 / 9)); // 2
    expect(diem(3)).toBe(Math.floor((22 * 3) / 9)); // 7
    expect(diem(5)).toBe(Math.floor((22 * 5) / 9)); // 12
  });

  it('mỗi nét đã tương tác = 3, mỗi việc đã làm/bỏ = 2, mỗi ngày có ghi = 1', () => {
    expect(mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 9, soNetDaTuongTac: 3, soViecDaLamHoacBo: 0, soNgayCoGhi: 0,
    }).phanTram).toBe(9);
    expect(mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 3, soNgayCoGhi: 0,
    }).phanTram).toBe(6);
    expect(mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: 5,
    }).phanTram).toBe(5);
  });

  it('⭐ trần ngày = 30 — sổ ghi cả tháng không đẩy riêng thanh vô hạn', () => {
    expect(mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: 90,
    }).phanTram).toBe(30);
  });

  it('⭐⭐⭐ LÀM = BỎ — soViecDaLamHoacBo (đầu vào của mucDoHieu) không phân biệt hai thứ', () => {
    const daLam: ViecNgayDau[] = [
      { loai: 'ghi', trangThai: 'xong', route: '' },
      { loai: 'ghi', trangThai: 'xong', route: '' },
    ];
    const daBo: ViecNgayDau[] = [
      { loai: 'ghi', trangThai: 'bo', route: '' },
      { loai: 'ghi', trangThai: 'bo', route: '' },
    ];
    expect(soViecDaLamHoacBo(daLam)).toBe(soViecDaLamHoacBo(daBo));
    expect(soViecDaLamHoacBo(daLam)).toBe(2);
  });

  it('⭐⭐⭐ đổi đáp án KHÔNG đổi điểm — soNetDaTuongTac chỉ đếm nét ĐÃ tương tác, không đếm giá trị', () => {
    // Bác nét rồi tự chọn chip A, hay tự chọn chip B — cùng một khoá `chanDungBac`
    // ('nhip'), nên điểm không đổi khi đổi ý giữa các chip.
    expect(soNetDaTuongTac({ chanDungBac: ['nhip'] })).toBe(1);
    expect(soNetDaTuongTac({ chanDungBac: ['nhip', 'nhip'] })).toBe(1); // trùng khoá — không cộng đôi
  });

  it('⭐⭐⭐ 10 khoản trong CÙNG MỘT NGÀY = 1 điểm ngày, không phải 10', () => {
    const so: Khoan[] = Array.from({ length: 10 }, (_, i) => khoan('2026-09-20', `k${i}`));
    expect(soNgayCoGhi(so)).toBe(1);
    expect(mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: soNgayCoGhi(so),
    }).phanTram).toBe(1);
  });

  it('⭐ ba mốc HỎI 25 · ĐOÁN 40 · KHẲNG ĐỊNH 60, đúng biên', () => {
    const moc = (n: number) => mucDoHieu({
      soCauDaTraLoi: 9, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: n,
    }).moc;
    // 22 điểm sẵn từ 9/9 câu; +3 ngày = 25 ⇒ chạm mốc HỎI (đúng D356: "22 + 3 ngày ghi = 25").
    const m3 = moc(3);
    expect(m3.find((x) => x.ma === 'hoi')!.dat).toBe(true);
    expect(m3.find((x) => x.ma === 'doan')!.dat).toBe(false);
    const m2 = moc(2); // 22 + 2 = 24, chưa chạm HỎI
    expect(m2.find((x) => x.ma === 'hoi')!.dat).toBe(false);
  });

  it('⭐ trần 100 là HÀNG RÀO AN TOÀN, không phải đường thường — trần THẬT của công thức hôm nay là 79', () => {
    /*
     * ⚠ Mọi số hạng đã tự kẹp riêng (NET≤3, VIEC≤3, NGÀY≤30, CÂU/soCauToiDa≤soCauToiDa — ở
     * đây 9/9), nên tổng tối đa của bộ trọng số hôm nay là CỐ ĐỊNH: 22 + 3·3 + 2·3 + 1·30 +
     * 3+1+2+2+2+2 = 79 — dưới 100. `Math.min(100, …)` trong `mucDoHieu` vì thế CHƯA từng
     * phải cắt gì với bộ trọng số hiện tại; nó là hàng rào cho lúc founder tăng trọng số
     * (A8.2), không phải đường người dùng thật sự đi qua hôm nay. Đổi `HIEU_BAN` thì sửa
     * con số 79 ở đây.
     */
    const p = mucDoHieu({
      soCauDaTraLoi: 9, soCauToiDa: 9, soNetDaTuongTac: 3, soViecDaLamHoacBo: 3, soNgayCoGhi: 30,
      daTraLoiTheHoi: true, daPhanHoiMauLap: true, daGhiNhanGiuLuat: true,
      daQuyDoiKhoanLon: true, daChamCoIch: true, doanDaCham: true,
    }).phanTram;
    expect(p).toBe(79);
    expect(p).toBeLessThanOrEqual(100);
  });

  it('không đưa thành phần giai đoạn sau ⇒ mặc định 0, không ném', () => {
    expect(() => mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 9, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: 0,
    })).not.toThrow();
  });

  it('⭐⭐ `soCauToiDa: 0` KHÔNG được ra NaN (chia cho 0) — lưới an toàn thật (`mau = Math.max(1, soCauToiDa)`)', () => {
    /*
     * ⚠⚠ Đây không phải một ca lý thuyết: `soCauToiDa` tới từ `soCauPhongVan(hoSo)`, một
     * hàm THUẦN không có gì chặn nó bị gọi lệch hoặc bị mock hỏng. `Math.floor(x / 0)` ra
     * `Infinity`/`NaN`, và `NaN` chảy thẳng vào `phanTram` ⇒ thanh "mức độ hiểu bạn" BIẾN
     * MẤT khỏi màn hình mà không một lỗi nào bắn ra (đúng chú thích ⚠ ngay tại chỗ gọi
     * `Math.max(1, …)` trong `chan_dung.ts`).
     */
    const ket = mucDoHieu({
      soCauDaTraLoi: 0, soCauToiDa: 0, soNetDaTuongTac: 0, soViecDaLamHoacBo: 0, soNgayCoGhi: 0,
    });
    expect(Number.isNaN(ket.phanTram), 'phanTram không được là NaN').toBe(false);
    expect(ket.phanTram).toBe(0);
    for (const m of ket.moc) expect(Number.isNaN(m.p)).toBe(false);
  });
});

describe('§IV-bis — soNetDaTuongTac đếm nét ĐÃ TỪNG chạm, HOÀN TÁC không làm tụt (D358 — khớp demo)', () => {
  it('vector chép tay', () => {
    expect(soNetDaTuongTac({})).toBe(0);
    // đang bác 1 nét, đã từng chạm 2 nét ⇒ 2 (nét đã hoàn tác vẫn được tính)
    expect(soNetDaTuongTac({ chanDungBac: ['deu'], chanDungDaCham: ['deu', 'nhip'] })).toBe(2);
    // hoàn tác HẾT ⇒ chanDungBac rỗng, thanh vẫn giữ
    expect(soNetDaTuongTac({ chanDungBac: [], chanDungDaCham: ['nhip'] })).toBe(1);
    // hồ sơ ghi TRƯỚC khi có chanDungDaCham ⇒ rơi về chanDungBac, không ai tụt vì nâng bản
    expect(soNetDaTuongTac({ chanDungBac: ['nhip', 'nguon'] })).toBe(2);
    // khoá lạ + trùng lặp không thổi phồng: trần là ba nét
    expect(soNetDaTuongTac({ chanDungDaCham: ['nhip', 'nhip', 'la', 'deu', 'nguon', 'x'] })).toBe(3);
  });
});

describe('§V — ⭐⭐⭐ ba trường mới của hồ sơ KHÔNG lọt vào gói đặc trưng', () => {
  it('ctxCuaHoSo (cửa duy nhất dac_trung.ts đọc) không sinh dòng nào từ ba trường mới', () => {
    const h: HoSo = { chanDungBac: ['nhip', 'deu'], chanDungDaCham: ['nhip', 'deu', 'nguon'], chanDungNhip: 'ngày tệ', ngayDauBo: [0, 2] };
    expect(ctxCuaHoSo(h)).toEqual([]);
  });

  it('⭐ dac_trung.ts và dong_bo*.ts không hề nhắc tới ba trường mới trong MÃ NGUỒN', () => {
    const goc = path.resolve(__dirname, '..', 'src', 'pfm');
    for (const tep of ['dac_trung.ts', 'dong_bo.ts', 'dong_bo_chay.ts', 'dong_bo_kich.ts']) {
      const nguon = fs.readFileSync(path.join(goc, tep), 'utf8');
      for (const truong of ['chanDungBac', 'chanDungDaCham', 'chanDungNhip', 'ngayDauBo']) {
        expect(nguon.includes(truong), `${tep} nhắc tới "${truong}"`).toBe(false);
      }
    }
  });
});

describe('§VI — CHAN_DUNG_NOI_DUNG phủ kín, glyph theo luật ô chữ', () => {
  it('mọi mã của MA_CHAN_DUNG đều có nội dung, glyph ≤ O_CHU_TOI_DA ký tự HOA', () => {
    for (const ma of MA_CHAN_DUNG) {
      const nd = CHAN_DUNG_NOI_DUNG[ma];
      expect(nd, ma).toBeDefined();
      expect(nd.glyph.length, `${ma}.glyph dài ${nd.glyph.length}`).toBeLessThanOrEqual(O_CHU_TOI_DA);
      expect(nd.glyph, `${ma}.glyph phải viết HOA`).toBe(nd.glyph.toUpperCase());
      expect(nd.ten.length, `${ma}.ten trống`).toBeGreaterThan(2);
    }
  });

  it('⭐ chua_ro KHÔNG có dự đoán — bỏ câu 6 thì không đoán (P7)', () => {
    expect(CHAN_DUNG_NOI_DUNG.chua_ro.doan).toBe('');
    for (const ma of MA_CHAN_DUNG) {
      if (ma === 'chua_ro') continue;
      expect(CHAN_DUNG_NOI_DUNG[ma].doan.length, ma).toBeGreaterThan(10);
    }
  });
});

describe('§IV-ter — ⭐⭐ LỜI GẦN NHẤT THẮNG: trả lời LẠI một câu phỏng vấn ⇒ dấu vết "bác nét" dựng trên câu CŨ hết hiệu lực (D358)', () => {
  const GOC: HoSo = {
    nhip: ['ngay sau khi tiền về'], deu: 'thất thường', nguonThuNhan: ['gia đình cho'], nguonThu: 'tro_cap_gd',
    chanDungNhip: 'ngày tệ', chanDungBac: ['nhip', 'deu', 'nguon'], chanDungDaCham: ['nhip', 'deu', 'nguon'],
  };

  it('chép tay — `hoanTacNetTrenHoSo`: gỡ ĐÚNG một khoá; `nhip` bỏ luôn chip tự chọn; `chanDungDaCham` KHÔNG đổi; hết khoá thì trường VẮNG', () => {
    const a = hoanTacNetTrenHoSo(GOC, 'deu');
    expect(a.chanDungBac).toEqual(['nhip', 'nguon']);
    expect(a.chanDungNhip, 'gỡ nét `deu` không được đụng chip của nét `nhip`').toBe('ngày tệ');
    const b = hoanTacNetTrenHoSo(GOC, 'nhip');
    expect(b.chanDungBac).toEqual(['deu', 'nguon']);
    expect(b.chanDungNhip).toBeUndefined();
    expect(b.chanDungDaCham, 'thanh hiểu không tụt').toEqual(['nhip', 'deu', 'nguon']);
    const c = hoanTacNetTrenHoSo({ chanDungBac: ['deu'] }, 'deu');
    expect('chanDungBac' in c, 'mảng rỗng không được nằm lại trong kho (P7: vắng ≠ rỗng)').toBe(false);
    expect(GOC.chanDungBac, 'không sửa tại chỗ').toEqual(['nhip', 'deu', 'nguon']);
  });

  it('⭐⭐ lưu lại mà KHÔNG đổi câu nào ⇒ trả về NGUYÊN bản mới — màn phỏng vấn điền sẵn đáp án cũ, "có mặt" ≠ "vừa đổi"', () => {
    const moi: HoSo = { ...GOC, nhip: ['ngay sau khi tiền về'] }; // mảng MỚI, giá trị CŨ
    expect(donDauVetSauPhongVan(GOC, moi)).toBe(moi);
  });

  it('⭐⭐ đổi câu 6 ⇒ CHỈ nét `nhip` về gốc; đổi câu 2 ⇒ chỉ `deu`; đổi câu 1 (nhãn HOẶC mã) ⇒ chỉ `nguon`', () => {
    const a = donDauVetSauPhongVan(GOC, { ...GOC, nhip: ['cuối tháng'] });
    expect([a.chanDungNhip, a.chanDungBac]).toEqual([undefined, ['deu', 'nguon']]);
    const b = donDauVetSauPhongVan(GOC, { ...GOC, deu: 'đều mỗi tháng' });
    expect([b.chanDungNhip, b.chanDungBac]).toEqual(['ngày tệ', ['nhip', 'nguon']]);
    const c = donDauVetSauPhongVan(GOC, { ...GOC, nguonThuNhan: ['gia đình cho', 'làm thêm'] });
    expect(c.chanDungBac).toEqual(['nhip', 'deu']);
    const d = donDauVetSauPhongVan({ ...GOC, nguonThuNhan: undefined }, { ...GOC, nguonThuNhan: undefined, nguonThu: 'luong' });
    expect(d.chanDungBac, 'hồ sơ cũ chỉ có MÃ').toEqual(['nhip', 'deu']);
    for (const x of [a, b, c, d]) expect(x.chanDungDaCham).toEqual(['nhip', 'deu', 'nguon']);
  });

  it('"để sau" trên câu 6 (khoá bị XOÁ) cũng là ĐỔI; thêm một chip vào câu nhiều-lựa-chọn cũng là ĐỔI', () => {
    const { nhip: _bo, ...khongNhip } = GOC; void _bo;
    expect(donDauVetSauPhongVan(GOC, khongNhip).chanDungNhip).toBeUndefined();
    expect(donDauVetSauPhongVan(GOC, { ...GOC, nhip: ['ngay sau khi tiền về', 'cuối tháng'] }).chanDungNhip).toBeUndefined();
  });
});
