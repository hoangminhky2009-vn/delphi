/**
 * TÍNH CÁCH THẺ SỰ KIỆN — chống đúng hai kiểu hỏng IM LẶNG của cụm này.
 *
 * 1. Gõ sai tên lớp ⇒ `s['skXauu']` trả `undefined` ⇒ không lớp nào được áp.
 *    Không lỗi, không cảnh báo, hiệu ứng đơn giản là không có. Đây là dạng
 *    "cơ chế trang trí" mà repo đã dính 17 lần, ở tầng CSS Modules.
 * 2. Thêm một sự kiện mới vào `config/holdem.ts` mà quên khai tính cách ⇒ thẻ
 *    đó rơi về viền cyan mặc định. Cái đó KHÔNG sai (founder chốt thẻ thường
 *    giữ như cũ), nhưng phải là một lựa chọn CÓ Ý — nên test bắt kể ra.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Cùng idiom với `quantri.test.tsx`: `import.meta.url` không có trong môi
// trường jsdom của bộ test này, `process.cwd()` là gốc `web/`.
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const TSX = doc('src/components/holdem/MarketMap.tsx');
const CSS = doc('src/components/holdem/MarketMap.module.css');
const CFG = doc('../config/holdem.ts');

/** Bảng tính cách khai trong TSX, đọc bằng regex trên chính mã nguồn. */
function bangTinhCach(): { su_kien: string; o: string; chop: string }[] {
  const khoi = /const TINH_CACH_SU_KIEN[^=]*=\s*\{([\s\S]*?)\n\};/.exec(TSX);
  expect(khoi, 'không tìm thấy TINH_CACH_SU_KIEN').not.toBeNull();
  /*
   * ⚠⚠ BỘ ĐỌC KHÔNG ĐƯỢC PHỤ THUỘC THỨ TỰ TRƯỜNG — bài học phải học HAI LẦN.
   *
   * 23/08 bảng thêm `chat: [...]` và regex cũ đòi dấu `}` ngay sau `chop`, nên
   * nó lặng lẽ chỉ còn khớp MỘT dòng còn hình dạng cũ; ba bài dưới đỏ với chữ
   * "thiếu chien_tranh" — nghe như bảng bị xoá trong khi bảng còn nguyên. Bản
   * vá hôm đó chỉ nới đúng một nấc: bỏ dấu `}` nhưng VẪN đòi `o` rồi `chop`
   * DÍNH LIỀN NHAU. 24/08 bảng thêm `mau` và nó suýt gãy y hệt lần trước.
   *
   * ⇒ Nay tách hai thì: cắt từng ENTRY theo khối ngoặc, rồi trong mỗi entry tra
   * từng trường ĐỘC LẬP. Thêm trường mới ở bất kỳ đâu cũng không đụng bộ đọc.
   * Một bài canh mà cứ thêm dữ liệu là đỏ thì sẽ bị nới cho qua, và lúc đó nó
   * thôi canh gì (D79).
   */
  return [...khoi![1]!.matchAll(/(\w+):\s*\{([^{}]*)\}/g)]
    .map((m) => {
      const than = m[2]!;
      const tra = (ten: string) => new RegExp(`\\b${ten}:\\s*'([A-Za-z]+)'`).exec(than)?.[1];
      const o = tra('o');
      const chop = tra('chop');
      expect(o, `${m[1]}: thiếu trường \`o\``).toBeTruthy();
      expect(chop, `${m[1]}: thiếu trường \`chop\``).toBeTruthy();
      return { su_kien: m[1]!, o: o!, chop: chop! };
    });
}

describe('tính cách thẻ sự kiện', () => {
  it('bảng khai được ít nhất 4 thẻ founder chỉ định', () => {
    const ids = bangTinhCach().map((x) => x.su_kien);
    for (const id of ['chien_tranh', 'ha_lai_suat', 'tang_lai_suat', 'thien_nga_den']) {
      expect(ids, `thiếu ${id}`).toContain(id);
    }
  });

  it('MỌI lớp khai trong bảng đều TỒN TẠI trong CSS module', () => {
    /*
     * Bài đắt nhất file. Một chữ hoa gõ nhầm là hiệu ứng biến mất mà không ai
     * biết — và người kiểm bằng mắt sẽ chỉ thấy "thẻ này trông hơi nhạt".
     */
    for (const { su_kien, o, chop } of bangTinhCach()) {
      expect(CSS, `${su_kien}: thiếu .${o}`).toContain(`.${o}`);
      expect(CSS, `${su_kien}: thiếu .${chop}`).toContain(`.${chop}`);
    }
  });

  it('MỌI sự kiện trong config đều được khai tính cách', () => {
    /*
     * Nguồn là danh sách `SU_KIEN` của config chứ không phải một mảng chép tay
     * ở đây — chép tay thì hai bên trôi và bài test này thành đồ trang trí.
     */
    /*
     * ⚠ Cắt ĐÚNG khối `SU_KIEN` trước rồi mới quét. Bản đầu quét cả file và
     * khớp luôn cả TÀI SẢN (`btc` cũng có id/label/icon) — bài test đỏ với một
     * lời buộc tội sai. Regex rộng trên một file lớn là cách nhanh nhất để có
     * một bài test nói dối.
     */
    /*
     * ⚠ Mảng kết bằng `] as const;` chứ không phải `];`. Bản trước dừng ở
     * `\n];` nên nó KHÔNG khớp ở cuối SU_KIEN và chạy tiếp tới mảng sau, nuốt
     * luôn cả thẻ chiến thuật. Hai lần liên tiếp cùng một bài học: regex rộng
     * trên file lớn thì cái nó khớp không phải cái mình nghĩ.
     */
    const khoiSK = /export const SU_KIEN[^=]*=\s*\[([\s\S]*?)\n\]\s*as const;/.exec(CFG);
    expect(khoiSK, 'không tìm thấy SU_KIEN trong config').not.toBeNull();
    const ids = [...khoiSK![1]!.matchAll(/\{\s*id:\s*'(\w+)'/g)].map((m) => m[1]!);
    expect(ids.length, 'regex không khớp sự kiện nào').toBeGreaterThan(4);
    const daKhai = new Set(bangTinhCach().map((x) => x.su_kien));
    for (const id of ids) expect(daKhai, `sự kiện ${id} chưa khai tính cách`).toContain(id);
  });

  it('cú chớp có `pointer-events: none` — không được nuốt cú chạm', () => {
    /*
     * Một lớp phủ toàn màn nuốt cú chạm giữa lúc đang đếm giờ là lỗi TỆ HƠN
     * HẲN việc không có hiệu ứng nào: người chơi bấm mà không vào lệnh được.
     */
    const khoi = /\.chopMan\s*\{([^}]*)\}/.exec(CSS);
    expect(khoi).not.toBeNull();
    expect(khoi![1]!).toContain('pointer-events: none');
  });

  it('tính cách CHỈ áp cho ô đang lật, không áp cho ô đã qua', () => {
    // Cả dải nhấp nháy bảy màu thì không ai đọc được gì — và pin tụt.
    expect(TSX).toMatch(/trangThai === 'nay' && laSK/);
  });

  it('có nhánh prefers-reduced-motion cho các lớp mới', () => {
    /*
     * ⚠ Quét MỌI khối `prefers-reduced-motion`, không chỉ khối cuối. Bản đầu
     * dùng `lastIndexOf` — đúng khi file có duy nhất một khối, và sai IM LẶNG
     * ngay khi ai đó thêm khối thứ hai (23/08, cụm "bản chất thẻ"): bài đỏ với
     * chữ "thiếu skChienTranh" trong khi lớp ấy vẫn được tắt đàng hoàng ở khối
     * phía trên. Một bài báo động giả thì sẽ bị nới cho qua, và lúc đó nó thôi
     * canh gì (D79).
     */
    const giam = [...CSS.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)]
      .map((m) => m[1] ?? '').join('\n');
    expect(giam, 'không tìm thấy nhánh giảm chuyển động nào').not.toBe('');
    // D393: `skChienTranh` + `skLoi` đã gỡ (chiến tranh vào lá thiên nga, sập sàn thành cạn
    // thanh khoản) — không còn trong CSS nên cũng không còn gì để tắt.
    for (const c of ['skPhong', 'skTot', 'skXau', 'skBaoMon']) {
      expect(giam, `thiếu ${c} trong nhánh giảm chuyển động`).toContain(c);
    }
    // …và cả cụm BẢN CHẤT (23/08) + hiệu ứng trên nét vẽ của lá mới (D393).
    for (const c of ['rungHien', 'rungNhe', 'troBay', 'giat', 'quet', '.neon', '.vet']) {
      expect(giam, `thiếu ${c} trong nhánh giảm chuyển động`).toContain(c);
    }
  });
});
