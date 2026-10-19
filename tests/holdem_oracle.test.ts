/**
 * ORACLE PHẢI THẬT SỰ NHÌN THẤY — khoá hai lỗi tìm ra 26/07.
 *
 * Cả hai đều là lỗi IM LẶNG: typecheck xanh, 700+ test xanh, Monte Carlo chạy
 * ra số đẹp đẽ — và số đó đo một con bot mù tự xưng là sáng mắt. Suốt nhiều
 * phiên, G2/G4 đỏ bị chẩn đoán thành "tín hiệu quá yếu so với nhiễu" và người
 * ta đi chỉnh tham số cân bằng. Không tham số nào chữa nổi, vì bệnh không nằm
 * ở đó.
 *
 * ─── LỖI 1: đọc nhầm ô đã bị che ────────────────────────────────────────────
 * `BoiCanh` có `o` (đã CẮT cờ `la_tin_gia`, thứ người chơi thấy) và `oThat`
 * (nguyên vẹn, chỉ oracle được đọc). HAI Ô CÙNG KIỂU `OThiTruong`, nên đọc
 * nhầm thì TypeScript không hé một lời. Code đọc `ctx.o.la_tin_gia` → trên ô
 * đã cắt là `undefined` → luôn falsy → oracle luôn kết luận "tin thật", tức
 * hành xử ĐÚNG BẰNG bot "Tin mọi tin". `oThat` nạp vào từ đầu, không dòng nào
 * đọc tới.
 *
 * ─── LỖI 2: một niềm tin áp cho hai mẩu tin ─────────────────────────────────
 * `tinEcho()` trả MỘT số rồi đem nhân cho CẢ tin đang nổ LẪN dư âm tin trước —
 * hai mẩu tin độc lập nhau về thật/giả. Hiện `map.ts` cấm hai ô sự kiện liền
 * nhau nên trường hợp này CHƯA XẢY RA ĐƯỢC; test dưới đây khoá luôn cả luật
 * cấm đó, vì ngày nào luật ấy được nới thì lỗi 2 sống dậy ngay và im lặng.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sinhMap } from '../server/holdem/map.js';
import { BOT_V1_DONG_BANG } from '../server/holdem/bots.js';

const BOTS = readFileSync(new URL('../server/holdem/bots.ts', import.meta.url), 'utf8');

describe('oracle đọc đúng nguồn sự thật', () => {
  it('có đọc `oThat` — không phải chỉ khai báo rồi bỏ đó', () => {
    /*
     * Đây là test QUÉT MÃ NGUỒN, cố ý. Hành vi "oracle đoán đúng hơn" chỉ đo
     * được qua Monte Carlo 12.000 trận (quá chậm cho suite), mà chính Monte
     * Carlo lại là thứ đã bỏ lọt lỗi này nhiều phiên liền — nó báo "gate đỏ"
     * chứ không báo "bot mù". Nên chốt thẳng vào nguyên nhân.
     */
    expect(BOTS, '`oThat` khai báo mà không ai đọc = oracle mù')
      .toMatch(/ctx\.oThat\.kind === 'su_kien' \? ctx\.oThat\.la_tin_gia/);
  });

  it('KHÔNG đường nào lấy sự thật từ ô đã bị che (`ctx.o.la_tin_gia`)', () => {
    const pham = BOTS.split('\n')
      .map((d, i) => [i + 1, d] as const)
      .filter(([, d]) => /ctx\.o\.la_tin_gia/.test(d) && !d.trimStart().startsWith('*'));
    expect(pham.map(([i, d]) => `${i}: ${d.trim()}`), 'ô này đã cắt cờ → luôn falsy')
      .toEqual([]);
  });

  it('mỗi nguồn tin tra niềm tin RIÊNG, không dùng chung một số', () => {
    /*
     * Dư âm phải tra `oTruoc`, tin đang nổ phải tra `oThat` — hai lời gọi khác
     * nhau, và mỗi lời gọi kèm TỶ LỆ TIN GIẢ CỦA ĐÚNG Ô ĐÓ (v30 — trước đây
     * cả hai dùng 35% phẳng, xem `BoiCanh.tyLeGiaBp`).
     *
     * ⚠ Regex nới tới dấu phẩy thứ ba chứ không khoá nguyên văn cả lời gọi:
     * bài cũ khoá đúng chuỗi `niemTinTin(kieu, ctx.oTruoc.la_tin_gia)` nên vừa
     * thêm một tham số là đỏ dù hành vi đúng hơn trước. Bài test giòn theo
     * TEXT thì mỗi lần sửa đúng lại phải sửa nó — và cái giá thật là người ta
     * bắt đầu sửa test cho xanh thay vì đọc xem nó canh gì.
     */
    expect(BOTS).toMatch(/niemTinTin\(kieu,\s*ctx\.oTruoc\.la_tin_gia\s*,/);
    expect(BOTS).toMatch(/niemTinTin\(kieu,\s*laTinGiaThat\(ctx\)\s*,/);
    // Và hai lời gọi phải nhận HAI tỷ lệ khác nhau — gộp một là chiết khấu
    // tin này bằng độ tin của tin kia.
    expect(BOTS).toMatch(/ctx\.tyLeGiaTruocBp/);
    expect(BOTS).toMatch(/ctx\.tyLeGiaBp/);
  });
});

describe('luật cấm hai ô sự kiện liền nhau', () => {
  /*
   * Luật này là thứ khiến lỗi 2 chưa gây hại. Nếu nó mất, lỗi 2 sống dậy —
   * nên nó phải là luật CÓ TEST, không phải một câu comment trong map.ts.
   */
  it('không map nào có hai sự kiện kề nhau (200 seed)', () => {
    let soSuKien = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const map = sinhMap(seed, 8);
      for (let i = 0; i < map.o.length; i += 1) {
        if (map.o[i]!.kind !== 'su_kien') continue;
        soSuKien += 1;
        expect(map.o[i + 1]?.kind, `seed ${seed}: ô ${i} và ${i + 1} đều là sự kiện`)
          .not.toBe('su_kien');
      }
    }
    // Chống xanh rỗng: nếu không map nào sinh ra sự kiện thì vòng lặp trên
    // không kiểm gì cả mà vẫn xanh.
    expect(soSuKien, 'không sinh ra ô sự kiện nào để kiểm').toBeGreaterThan(100);
  });
});

describe('oracle là DỤNG CỤ ĐO, không phải đối thủ', () => {
  /*
   * Hai lý do, và lý do thứ hai mới là lý do cứng:
   *
   *  1. CÔNG BẰNG. Một đối thủ biết chắc tin nào giả thì người chơi không có
   *     đường nào thắng bằng kỹ năng đọc tin — đúng thứ trò này muốn dạy.
   *  2. TÍNH TÁI LẬP CỦA TRẬN CŨ. Trận được replay từ `(seed, action_log)`, và
   *     danh tính bot suy ra bằng `(seed + i) % BOT_V1_DONG_BANG.length`. Chừng
   *     nào oracle còn NGOÀI danh sách này thì mọi lần sửa hành vi `biet_that`
   *     (như bản vá `oThat` ngày 26/07) đều KHÔNG viết lại trận đã lưu. Cho
   *     oracle vào đây là mất lá chắn đó — im lặng, không lỗi, không cách nào biết.
   */
  it('oracle KHÔNG nằm trong danh sách bot đóng băng của trận thật', () => {
    expect(BOT_V1_DONG_BANG).not.toContain('oracle');
    expect(BOT_V1_DONG_BANG).not.toContain('bam_bua');
    expect(BOT_V1_DONG_BANG.length, 'đổi độ dài là viết lại đối thủ mọi trận cũ')
      .toBe(6);
  });
});
