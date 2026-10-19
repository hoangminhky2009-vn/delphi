/**
 * KHO BẠC LÀM NGÂN HÀNG TRUNG ƯƠNG — property test cho lớp ĐO và lớp LUẬT.
 *
 * Cả hai lớp đều thuần nên quét được TOÀN MIỀN tham số, và đó là chỗ duy nhất
 * chứng minh được mấy tính chất mà một nhà điều tiết bắt buộc phải có: không
 * rung, không vượt bước, không ra khỏi khoảng, không tự in tiền.
 */
import { describe, it, expect } from 'vitest';
import { CHINH_SACH, CHINH_SACH_VERSION, RO_HANG_VERSION } from '../config/chinh_sach.js';
import { DANG_CHUAN, SO_PHIEN_BAN } from '../config/phien_ban.js';
import {
  BAC_TRONG_RO, chiSoNiemYet, chiSoThucHien, giaGocRo, roRong, tongTrongSoBp,
} from '../server/kinh_te/chi_so_gia.js';
import { quyetDinhChinhSach } from '../server/kinh_te/chinh_sach.js';

const MUC_TIEU = CHINH_SACH.MUC_TIEU_BP;
const SAN = CHINH_SACH.HS_QUY_SAN_BP;
const TRAN = CHINH_SACH.HS_QUY_TRAN_BP;

describe('Chỉ số giá — phép đo phải có gốc so, nếu không thì vô nghĩa', () => {
  it('tổng trọng số rổ đúng 10.000 bp — thiếu/thừa là mất kỳ gốc', () => {
    expect(tongTrongSoBp()).toBe(10_000);
  });

  it('giá kỳ gốc: vector chép tay 72 / 216 / 720 T', () => {
    expect(giaGocRo('thuong')).toBe(72n);
    expect(giaGocRo('hiem')).toBe(216n);
    expect(giaGocRo('epic')).toBe(720n);
  });

  it('kỳ gốc cho đúng 10.000 bp (chỉ số 100) — định nghĩa, không phải trùng hợp', () => {
    expect(chiSoNiemYet(10_000)).toBe(10_000);
  });

  it('CHỈ SỐ NIÊM YẾT GẦN NHƯ LÀ CÁCH VIẾT LẠI CHÍNH CÔNG CỤ — đo bằng số', () => {
    // Đây là bằng chứng cho luật "không lái theo chỉ số niêm yết": nhiệt kế đặt
    // cạnh lò sưởi. Lệch tối đa trên TOÀN miền là 197 bp, tức dưới 2%.
    let max = 0;
    for (let q = 0; q <= 10_000; q += 1) {
      max = Math.max(max, Math.abs(chiSoNiemYet(q)! - q));
    }
    expect(max).toBe(197);
    // Và trùng khít ở ba mốc neo.
    expect(chiSoNiemYet(0)).toBe(0);
    expect(chiSoNiemYet(5_000)).toBe(5_000);
    expect(chiSoNiemYet(10_000)).toBe(10_000);
  });

  it('chỉ số niêm yết ĐƠN ĐIỆU không giảm theo công cụ — không có chỗ lật ngược', () => {
    for (let q = 1; q <= 10_000; q += 1) {
      expect(chiSoNiemYet(q)!).toBeGreaterThanOrEqual(chiSoNiemYet(q - 1)!);
    }
  });

  it('hôm nay chỉ số THỰC HIỆN là `null` — chưa có chợ, và đó là sự thật', () => {
    expect(chiSoThucHien(roRong())).toBeNull();
  });

  it('thiếu MỘT bậc ⇒ null cả chỉ số, KHÔNG chia lại trọng số (đổi rổ = mất nghĩa)', () => {
    const day: Record<string, bigint | null> = {};
    for (const b of BAC_TRONG_RO) day[b] = giaGocRo(b);
    expect(chiSoThucHien({ theoBac: day })).toBe(10_000);
    for (const thieu of BAC_TRONG_RO) {
      expect(chiSoThucHien({ theoBac: { ...day, [thieu]: null } }), `thiếu ${thieu}`).toBeNull();
    }
  });

  it('giá thực hiện gấp đôi kỳ gốc ⇒ chỉ số 20.000 bp (lạm phát 100%)', () => {
    const doi: Record<string, bigint | null> = {};
    for (const b of BAC_TRONG_RO) doi[b] = giaGocRo(b) * 2n;
    expect(chiSoThucHien({ theoBac: doi })).toBe(20_000);
  });

  it('từ chối đầu vào vô nghĩa', () => {
    expect(() => chiSoNiemYet(-1)).toThrow();
    expect(() => chiSoNiemYet(10_001)).toThrow();
    expect(() => chiSoThucHien({ theoBac: { thuong: -1n, hiem: 1n, epic: 1n } })).toThrow();
  });
});

describe('Luật chính sách — bốn tính chất một nhà điều tiết bắt buộc phải có', () => {
  const dai = (buoc: number) => {
    const ra: number[] = [];
    for (let q = SAN; q <= TRAN; q += buoc) ra.push(q);
    return ra;
  };

  it('TẤT ĐỊNH: cùng số đo ⇒ cùng quyết định, gọi bao nhiêu lần cũng thế', () => {
    const s = { chiSoThucHienBp: 13_000, hsQuyBpHienTai: 8_000 };
    const a = quyetDinhChinhSach(s);
    for (let i = 0; i < 5; i += 1) expect(quyetDinhChinhSach(s)).toEqual(a);
  });

  it('FAIL-CLOSED: chưa đo được ⇒ KHÔNG đổi gì, mọi vị trí công cụ', () => {
    for (const q of dai(1)) {
      const qd = quyetDinhChinhSach({ chiSoThucHienBp: null, hsQuyBpHienTai: q });
      expect(qd.doi).toBe(false);
      expect(qd.hsQuyBpMoi).toBe(q);
      expect(qd.lyDoMa).toBe('chua_do_duoc');
      expect(qd.lechBp).toBeNull();
    }
  });

  it('KHÔNG RUNG: trong biên độ thì đứng yên, mọi vị trí công cụ', () => {
    for (const lech of [-CHINH_SACH.BIEN_DO_BP, 0, CHINH_SACH.BIEN_DO_BP]) {
      for (const q of dai(137)) {
        const qd = quyetDinhChinhSach({
          chiSoThucHienBp: MUC_TIEU + lech, hsQuyBpHienTai: q,
        });
        expect(qd.doi, `lệch ${lech} tại ${q}`).toBe(false);
        expect(qd.lyDoMa).toBe('trong_bien_do');
      }
    }
  });

  it('ĐÚNG CHIỀU · ĐÚNG BƯỚC · ĐÚNG KHOẢNG — quét toàn miền', () => {
    let soCa = 0;
    for (let chiSo = 0; chiSo <= 30_000; chiSo += 211) {
      for (const q of dai(97)) {
        const qd = quyetDinhChinhSach({ chiSoThucHienBp: chiSo, hsQuyBpHienTai: q });
        const nhan = `chỉ số ${chiSo} tại ${q} → ${qd.hsQuyBpMoi} (${qd.lyDoMa})`;
        soCa += 1;
        // KHOẢNG: không bao giờ ra ngoài sàn/trần.
        expect(qd.hsQuyBpMoi, nhan).toBeGreaterThanOrEqual(SAN);
        expect(qd.hsQuyBpMoi, nhan).toBeLessThanOrEqual(TRAN);
        // BƯỚC: không bao giờ nhảy quá trần tốc độ.
        expect(Math.abs(qd.hsQuyBpMoi - q), nhan).toBeLessThanOrEqual(CHINH_SACH.BUOC_TOI_DA_BP);
        // CHIỀU: giá cao hơn mục tiêu ⇒ chỉ được THẮT (hạ hệ số), không nới.
        if (chiSo > MUC_TIEU) expect(qd.hsQuyBpMoi, nhan).toBeLessThanOrEqual(q);
        if (chiSo < MUC_TIEU) expect(qd.hsQuyBpMoi, nhan).toBeGreaterThanOrEqual(q);
      }
    }
    expect(soCa).toBeGreaterThan(1_000);
  });

  it('KHÔNG DAO ĐỘNG: lặp 200 kỳ ở chỉ số cố định ⇒ đơn điệu rồi đứng im', () => {
    for (const chiSo of [0, 4_000, 9_000, 11_000, 16_000, 30_000]) {
      for (const batDau of [SAN, 6_000, TRAN]) {
        let q = batDau;
        const day: number[] = [q];
        for (let i = 0; i < 200; i += 1) {
          q = quyetDinhChinhSach({ chiSoThucHienBp: chiSo, hsQuyBpHienTai: q }).hsQuyBpMoi;
          day.push(q);
        }
        const huong = Math.sign(day[1]! - day[0]!);
        for (let i = 1; i < day.length; i += 1) {
          const b = Math.sign(day[i]! - day[i - 1]!);
          // Mỗi bước đi đúng một hướng, hoặc đứng yên. Không bao giờ quay đầu.
          expect(b === 0 || b === huong, `chỉ số ${chiSo} từ ${batDau}: quay đầu ở bước ${i}`)
            .toBe(true);
        }
        // Đã tới điểm bất động và ở lại đó.
        const cuoi = day[day.length - 1]!;
        expect(quyetDinhChinhSach({ chiSoThucHienBp: chiSo, hsQuyBpHienTai: cuoi }).doi)
          .toBe(false);
      }
    }
  });

  it('KHÔNG IN ĐƯỢC TIỀN — quyết định không có hình dạng để chở một khoản T', () => {
    const qd = quyetDinhChinhSach({ chiSoThucHienBp: 30_000, hsQuyBpHienTai: TRAN });
    for (const [k, v] of Object.entries(qd)) {
      expect(typeof v, `trường ${k} là bigint, tức chính sách vừa mọc ra một đường tiền`)
        .not.toBe('bigint');
    }
    // Và không trường nào tên như một khoản tiền.
    expect(Object.keys(qd).some((k) => /^(t|so_t|tien|khoan|chi|thu)$/i.test(k))).toBe(false);
  });

  it('cấu hình công cụ ngoài khoảng bị KÉO VỀ, không được giữ nguyên', () => {
    const qd = quyetDinhChinhSach({ chiSoThucHienBp: null, hsQuyBpHienTai: 0 });
    expect(qd.hsQuyBpMoi).toBe(SAN);
    expect(qd.doi).toBe(true);
  });

  it('phiên bản luật: có mặt, đúng khuôn D196, KHÔNG nhúng D-số/ngày/tên mùa', () => {
    const qd = quyetDinhChinhSach({ chiSoThucHienBp: null, hsQuyBpHienTai: 8_000 });
    expect(qd.version).toBe(CHINH_SACH_VERSION);
    // ⚠ DÙNG LẠI `DANG_CHUAN` của sổ đăng ký, KHÔNG chép một regex thứ hai —
    // bản thứ hai của cùng một luật sẽ trôi (D61/A11.5). Bản đầu của bài này
    // chép tay, và chép SAI: nó cho biệt danh có gạch nối, nên nó xanh trong
    // khi `tests/phien_ban.test.ts` đỏ. Hai thước đo cùng một thứ là một thước
    // rưỡi.
    expect(CHINH_SACH_VERSION).toMatch(DANG_CHUAN);
    expect(RO_HANG_VERSION).toMatch(DANG_CHUAN);
  });

  it('⭐ cả hai trục phiên bản mới ĐÃ KHAI trong sổ đăng ký (D196)', () => {
    for (const ten of ['CHINH_SACH_VERSION', 'RO_HANG_VERSION']) {
      const truc = SO_PHIEN_BAN.find((t) => t.ten === ten);
      expect(truc, `${ten} chưa khai trong config/phien_ban.ts`).toBeDefined();
      expect(truc!.o).toBe('config/chinh_sach.ts');
      expect(truc!.mien).toBe('kinh_te');
      // Chưa ghi vào một dòng dữ liệu nào — đúng hôm nay. Đổi khi đóng dấu ledger.
      expect(truc!.luu_db).toBe(false);
    }
  });

  it('từ chối đầu vào vô nghĩa thay vì trả một quyết định trông có lý', () => {
    expect(() => quyetDinhChinhSach({ chiSoThucHienBp: 0, hsQuyBpHienTai: -1 })).toThrow();
    expect(() => quyetDinhChinhSach({ chiSoThucHienBp: 0, hsQuyBpHienTai: 10_001 })).toThrow();
    expect(() => quyetDinhChinhSach({ chiSoThucHienBp: -1, hsQuyBpHienTai: 8_000 })).toThrow();
  });
});
