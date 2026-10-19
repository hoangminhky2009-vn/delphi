import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { taoTran } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';

/*
 * ══════════════════════════════════════════════════════════════════════════
 * BÀN ĐO PHẢI ĐO ĐÚNG TẤM MAP CỦA BỘ LUẬT ĐANG SHIP
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ LỖI NÀY ĐÃ QUAY LẠI BA LẦN. `scripts/holdem_montecarlo.ts` từng gọi
 * `taoTran(...)` KHÔNG kèm `soO` rồi ghi đè map bằng `sinhMap(seed, CO_MAP)` —
 * mà `sinhMap` thiếu tham số thứ ba thì TẮT HẾT cổng hành vi (không lịch,
 * không quán tính, không sức căng, không chu kỳ, không telegraph, không v28,
 * không bản sắc map). Trạng thái vẫn mang cờ của bộ luật đang ship, nên bàn đo
 * chạy một trò NÓI RẰNG có v28 trên một tấm map KHÔNG CÓ v28.
 *
 * · D83 (11/08) chẩn đúng, viết trọn một đoạn chú thích "đã sửa 11/08"…
 * · …nhưng **để nguyên dòng code**. Từ 11/08 tới 15/08 file KHAI đã sửa trong
 *   khi chưa sửa, nên mọi số G1–G4 ở map 12/16 trong quãng đó — gồm cả bảng
 *   "G1 xanh khắp nơi" của chính D83 — vẫn đo một tấm map tắt hết cổng.
 * · Đo A/B ngày 15/08 cho thấy cái giá: map 12 bench hỏng ra G1 ✗ / G4 ✗,
 *   bench đúng ra G1 ✓ / G4 ✓. Tức "G4 đỏ ở map lớn" là LỖI THƯỚC, không phải
 *   nợ của trò.
 *
 * ⇒ Bài học không phải "nhớ sửa" mà là: **một chú thích tuyên bố đã sửa thì
 * nguy hiểm hơn không có chú thích nào** — nó làm người sau thôi kiểm. Nên nó
 * phải được khoá bằng TEST, không bằng chữ.
 */

const NGUON = readFileSync(
  resolve(process.cwd(), 'scripts/holdem_montecarlo.ts'), 'utf8');

/**
 * Bỏ chú thích khối và chú thích dòng.
 *
 * ⚠ PHẢI BỎ CHÚ THÍCH TRƯỚC KHI QUÉT, và đây chính là chỗ bài test này suýt
 * thành báo động giả: đoạn chú thích ở đầu `holdem_montecarlo.ts` NHẮC ĐÍCH
 * DANH `sinhMap(seed, CO_MAP)` để kể lại lỗi cũ. Quét thô là bài đỏ vĩnh viễn
 * trên một file đã đúng — mà một bài test báo động giả sẽ bị tắt đi, và lúc đó
 * nó không còn canh gì (bài học D79).
 */
function bocChuThich(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('bàn đo G1–G4 — cỡ map đi qua taoTran, KHÔNG sinh map lần hai', () => {
  const ma = bocChuThich(NGUON);

  it('⭐⭐ không còn một lời gọi `sinhMap(` nào trong CODE', () => {
    expect(ma.includes('sinhMap('),
      'bàn đo lại sinh map lần thứ hai — mọi số ở map ≠ mặc định sẽ đo một trò '
      + 'TẮT HẾT cổng hành vi, và nó ra bảng số trông rất hợp lý (D83, lần thứ 3)')
      .toBe(false);
  });

  it('⭐ `taoTran(` trong bàn đo nhận ĐỦ cỡ map (tham số thứ tư)', () => {
    // Bàn đo gọi taoTran đúng một lần; chuỗi tham số trải nhiều dòng nên bắt
    // theo MỐC ĐÓNG NGOẶC của lời gọi thay vì cố khớp cả khối.
    const i = ma.indexOf('taoTran(');
    expect(i, 'bàn đo không còn gọi taoTran — cấu trúc đã đổi, đọc lại file')
      .toBeGreaterThan(-1);
    expect(/taoTran\([\s\S]{0,400}?CO_MAP\s*\)/.test(ma),
      'CO_MAP phải là THAM SỐ CỦA taoTran, không phải xuất hiện đâu đó gần đó')
      .toBe(true);
  });

  it('⭐ và đây là VÌ SAO nó đắt: thiếu bộ luật thì map mất sạch cổng hành vi', () => {
    /*
     * Bài này không quét chữ mà ĐO: cùng seed, cùng cỡ map, chỉ khác chỗ bộ
     * luật có được truyền hay không. Hai tấm map phải KHÁC NHAU — nếu chúng
     * giống nhau thì cổng hành vi không có tác dụng gì, và cả câu chuyện trên
     * là vô nghĩa (khi đó phải đọc lại `sinhMap`, không phải sửa bài test).
     */
    const luat = luatCua(HOLDEM_BALANCE_VERSION);
    const ghe = [0, 1, 2, 3, 4].map((i) => ({
      id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
      danh_muc: { tai_san: [], chien_thuat: [] },
    }));
    const coLuat = taoTran(20260815, ghe, luat, 12);
    const khongLuat = taoTran(20260815, ghe, {}, 12);
    expect(coLuat.map.o.length).toBe(12);
    expect(khongLuat.map.o.length).toBe(12);
    expect(JSON.stringify(coLuat.map.o) === JSON.stringify(khongLuat.map.o),
      'map có bộ luật và map không bộ luật RA GIỐNG HỆT — cổng hành vi đang '
      + 'không vào sinhMap, đọc lại `sinhMap` trước khi tin bất kỳ số gate nào')
      .toBe(false);
  });
});
