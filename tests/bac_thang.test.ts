/**
 * BẬC THANG GIAI ĐOẠN — bài canh cho `config/bac_thang.ts` (A4-3, 03/09/2026).
 *
 * ⚠ VÌ SAO CẦN TEST: `config/bac_thang.ts` là một sổ CHÉP TAY (mỗi trigger trỏ
 * tới một chỗ khác trong repo) — đúng hình dạng đã trôi trước đây
 * (`config/phien_ban.ts`/D169: danh sách cờ chép tay dừng ở v32 rồi lặng lẽ
 * dán nhãn sai cho mọi trận v35 — không lỗi, không test đỏ, chỉ có dữ liệu
 * sai). Không có bài canh thì một con trỏ có thể trỏ vào hư không nhiều tháng
 * mà không ai biết, cho tới lúc có người đi theo nó và thấy trống.
 *
 * Hai nhóm, bốn bài, đúng bốn việc cần canh: (I) mỗi bậc đúng hình dạng đã
 * khai + mọi con trỏ RESOLVE được (file có thật, hằng số có thật trong file
 * đó); (II) ba tài liệu rải rác cũ + doc kể-lại-bằng-lời đều trỏ NGƯỢC về sổ
 * đăng ký này, và bản kể-lại-bằng-lời không lặng lẽ chép một con số vào (D61).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BAC_THANG } from '../config/bac_thang.js';

const GOC = process.cwd();
const doc = (p: string) => readFileSync(join(GOC, p), 'utf8');

/** Cắt phần " §..." ở cuối một con trỏ (`"file.md §6"`) để còn lại đường dẫn tệp. */
function boMuc(o: string): string {
  return o.split(/\s+§/)[0]!.trim();
}

const KIEU_HOP_LE = new Set(['khong', 'hang_so', 'phap_ly', 'cho', 'quyet_dinh']);

/**
 * Tên hằng số có xuất hiện như một KHAI BÁO trong tệp không — chứ không phải
 * chỉ được nhắc đâu đó trong lời văn.
 *
 * ⚠⚠ VÌ SAO PHẢI BỎ DÒNG CHÚ THÍCH TRƯỚC KHI TÌM — D216 lộ ra, siết ở đây.
 * Bản đầu của bậc `kho_lanh` đặt hằng số NGAY TRONG `config/bac_thang.ts` rồi
 * trỏ vào chính tệp đó. Phép kiểm cũ chỉ hỏi *"tệp có chứa chuỗi này không"*,
 * mà chuỗi `ten` thì LUÔN nằm trong tệp — nó chính là một phần của dòng khai
 * trigger. Nghĩa là với con trỏ tự-trỏ-vào-mình, bài này KHÔNG BAO GIỜ đỏ
 * được, với BẤT KỲ tên nào, kể cả tên bịa. Một hàng rào không thể đỏ là hàng
 * rào RỖNG — đúng họ với mấy bài canh đã bị quét ra ở D209.
 *
 * Nay đòi `TEN` đứng ngay trước `:` hoặc `=`, trên một dòng KHÔNG phải chú
 * thích. Khớp cả `export const TEN = 300` lẫn `TEN: 150` bên trong một object
 * (đúng hình dạng `TRAN_TRONG` ở `web/worker/cong.js`).
 */
function coKhaiBao(noiDung: string, ten: string): boolean {
  const than = noiDung.split('\n')
    .filter((d) => {
      const t = d.trim();
      return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*'));
    })
    .join('\n');
  return new RegExp(`(^|[^\\w.])${ten}\\s*[:=]`, 'm').test(than);
}

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Hình dạng đúng, và mọi con trỏ RESOLVE được', () => {
  it('mỗi bậc có trigger đúng kiểu đã khai; `cho` có mã câu; `hang_so` có o + ten', () => {
    const loi: string[] = [];
    for (const b of BAC_THANG) {
      const t = b.trigger;
      if (!KIEU_HOP_LE.has(t.kieu)) { loi.push(`${b.ten}: kiểu trigger lạ "${t.kieu}"`); continue; }
      if (t.kieu === 'cho' && t.cau.length === 0) loi.push(`${b.ten}: trigger cho thiếu mã câu`);
      if (t.kieu === 'hang_so' && (!t.o || !t.ten)) loi.push(`${b.ten}: trigger hang_so thiếu o hoặc ten`);
    }
    expect(loi, 'trigger sai hình dạng').toEqual([]);
  });

  it('con trỏ `hang_so` chứa đúng tên hằng số; con trỏ `phap_ly`/`cho`/`quyet_dinh` trỏ tới file có thật', () => {
    const hong: string[] = [];
    for (const b of BAC_THANG) {
      const t = b.trigger;
      if (t.kieu === 'hang_so') {
        if (!existsSync(join(GOC, t.o))) { hong.push(`${b.ten}: không có file ${t.o}`); continue; }
        if (!coKhaiBao(doc(t.o), t.ten)) {
          hong.push(
            `${b.ten}: ${t.o} không KHAI BÁO "${t.ten}" — chỉ được nhắc trong `
            + 'lời văn thì vẫn là con trỏ chết');
        }
      } else if (t.kieu === 'phap_ly' || t.kieu === 'cho' || t.kieu === 'quyet_dinh') {
        const tep = boMuc(t.o);
        if (!existsSync(join(GOC, tep)) && !/^docs\/(nhat-ky|luat\/0[156])/.test(tep)) hong.push(`${b.ten}: không có file ${tep} (từ "${t.o}")`);
      }
    }
    expect(hong, 'con trỏ chết — trỏ vào hư không').toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Tài liệu rải rác trỏ NGƯỢC về sổ đăng ký, và không lặng lẽ chép số (D61)', () => {

  it('docs/giai-doan.md không in ngưỡng số nào — chỉ có con trỏ', () => {
    // Thước hẹp có chủ ý (D79/D125: bài quét cả repo mà báo động giả sẽ bị nới
    // cho qua). Bắt đúng hình dạng "số + đơn vị", không bắt số nói chung — ngày
    // ở đầu trang (`03/09/2026`) không có đơn vị theo sau nên không khớp.
    const trang = doc('docs/giai-doan.md');
    const pham = trang.match(/\b\d{2,}\s*(MB|GB|ms|s|%|người|request|lượt)\b/gi);
    expect(pham, 'docs/giai-doan.md có vẻ đang CHÉP một ngưỡng thay vì TRỎ tới nó').toBeNull();
  });
});
