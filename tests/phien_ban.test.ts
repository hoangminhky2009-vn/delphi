/**
 * SỔ ĐĂNG KÝ PHIÊN BẢN — chống trôi (founder 31/08).
 *
 * ⚠ VÌ SAO CẦN TEST CHỨ KHÔNG CHỈ CẦN FILE: một bản đồ chép tay KHÔNG có bài
 * canh thì sẽ trôi, và trôi im lặng. Repo đã trả giá đúng thế ở D169 (danh sách
 * cờ chép tay dừng ở v32 rồi dán nhãn sai cho mọi trận v35 — không lỗi, không
 * test đỏ, chỉ có dữ liệu sai). `config/phien_ban.ts` là một bản đồ chép tay
 * nữa; file này là thứ giữ nó đúng.
 *
 * ⚠ THƯỚC PHẢI HẸP. Một bài quét cả repo mà báo động giả sẽ bị nới cho qua rồi
 * thôi canh gì (D79/D125). Nên nó chỉ bắt đúng một hình dạng: hằng số EXPORT,
 * TÊN VIẾT HOA, có chữ VERSION hoặc PHIEN_BAN.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BAN_PHAT_HANH, DANG_CHUAN, MUA, NHAN_MIEN, SO_PHIEN_BAN,
} from '../config/phien_ban.js';

const GOC = process.cwd();
const doc = (p: string) => readFileSync(join(GOC, p), 'utf8');

/** Mọi file nguồn có thể khai một trục phiên bản. */
function nguon(): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    let ds;
    try { ds = readdirSync(join(GOC, d), { withFileTypes: true }); } catch { return; }
    for (const e of ds) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) {
        if (!/node_modules|dist|\.git|coverage/.test(e.name)) di(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) ra.push(p);
    }
  };
  for (const d of ['config', 'server', 'web/src', 'api']) di(d);
  return ra;
}

/**
 * Hằng số EXPORT tên viết hoa có chữ VERSION / PHIEN_BAN.
 *
 * ⚠ Bóc chú thích TRƯỚC khi quét — nếu không, chính đoạn văn giải thích luật
 * (nó có nhắc tên hằng) sẽ bị bắt là một khai báo. Repo đã dính đúng bẫy này ở
 * `pixelui.test.tsx` và D185.
 */
function quetHang(): Array<{ ten: string; o: string }> {
  const ra: Array<{ ten: string; o: string }> = [];
  for (const f of nguon()) {
    const src = doc(f)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    /*
     * ⚠ BẮT TÊN RỒI MỚI LỌC, KHÔNG NHÚNG TỪ KHOÁ VÀO REGEX. Bản đầu viết
     * `[A-Z][A-Z0-9_]*(VERSION|PHIEN_BAN)…` — đòi có ít nhất MỘT ký tự trước từ
     * khoá, nên mọi hằng BẮT ĐẦU bằng từ khoá (`PHIEN_BAN_KHO`) đi lọt IM LẶNG.
     * Chính bài test này bắt được nó ở lượt chạy đầu.
     */
    for (const m of src.matchAll(/^\s*export\s+const\s+([A-Z][A-Z0-9_]*)\s*[:=]/gm)) {
      const ten = m[1]!;
      if (!/VERSION|PHIEN_BAN/.test(ten)) continue;
      if (KHONG_PHAI_TRUC.has(ten)) continue;
      ra.push({ ten, o: f });
    }
  }
  return ra;
}

/**
 * Hằng NÓI VỀ phiên bản nhưng KHÔNG PHẢI một trục phiên bản — chúng là danh sách
 * phái sinh, không mang giá trị nào được ghi vào dữ liệu.
 *
 * ⚠ Danh sách này phải NGẮN và mỗi tên phải có lý do. Nhét một trục thật vào đây
 * để test hết đỏ là đúng cách vô hiệu hoá cả bộ canh.
 */
const KHONG_PHAI_TRUC = new Set([
  'SO_PHIEN_BAN',    // chính cuốn sổ
  'PHIEN_BAN_SONG',  // danh sách phiên bản còn dựng lại được, suy từ registry (D192)
]);

/** Trục đã nằm trong dữ liệu prod với định dạng cũ — xem `DANG_CHUAN`. */
const MIEN_TRU_DANG = new Set([
  'balance-v2-D20',                 // D-số nhúng vào chuỗi phiên bản
  'level-v1-2026-07-25',            // ngày nhúng vào chuỗi
  'nv-v1-mua-0.0-2026-07-27',       // ngày + tên mùa nhúng vào chuỗi
  '2',                              // DIEN_MAO_PHIEN_BAN — số trần, không tiền tố
  'holdem-v0.1.0-lat1',             // semver + hậu tố
  'arena-v0.4.1',                   // semver, sản phẩm đã chết
  'v0.4.0-gd4',                     // API_VERSION — semver + giai đoạn
]);

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Sổ đăng ký phủ kín, không trôi', () => {
  it('MỌI hằng phiên bản trong code đều có mặt trong sổ', () => {
    /*
     * Đây là bài chịu lực. Thêm một `export const X_VERSION` mới mà quên khai ở
     * `config/phien_ban.ts` ⇒ đỏ ngay lúc viết, chứ không phải sáu tháng sau lúc
     * ai đó đi tìm "app đang ở bản nào" và thấy mười lăm câu trả lời.
     */
    const trongCode = quetHang();
    const daKhai = new Set(SO_PHIEN_BAN.map((t) => t.ten));
    const thieu = trongCode.filter((h) => !daKhai.has(h.ten));
    expect(thieu.map((h) => `${h.ten} (${h.o})`),
      'hằng phiên bản chưa khai trong config/phien_ban.ts').toEqual([]);
  });

  it('MỌI dòng trong sổ đều trỏ tới một khai báo CÓ THẬT', () => {
    // Chiều ngược lại: sổ giữ tên một hằng đã bị xoá thì nó đang nói dối về
    // repo, và người đọc sẽ đi tìm một file không còn gì.
    const ma: string[] = [];
    for (const t of SO_PHIEN_BAN) {
      let src: string;
      try { src = doc(t.o); } catch { ma.push(`${t.ten}: KHÔNG có file ${t.o}`); continue; }
      if (!new RegExp(`export\\s+const\\s+${t.ten}\\b`).test(src)) {
        ma.push(`${t.ten}: file ${t.o} không khai hằng này`);
      }
    }
    expect(ma, 'dòng ma trong sổ đăng ký').toEqual([]);
  });

  it('mọi miền đều có nhãn, và mọi trục thuộc một miền hợp lệ', () => {
    for (const t of SO_PHIEN_BAN) {
      expect(NHAN_MIEN[t.mien], `trục ${t.ten} có miền lạ`).toBeTruthy();
    }
    // Sáu miền là khung chia của patch note — thừa/thiếu một miền là patch note
    // có một nhóm không ai viết vào, hoặc một thay đổi không có nhóm để vào.
    expect(Object.keys(NHAN_MIEN)).toHaveLength(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Định dạng — luật áp cho trục MỚI, không hồi tố', () => {
  it('⚠ CẤM nhúng D-số vào chuỗi phiên bản (trừ ca cũ đã vào dữ liệu prod)', () => {
    /*
     * `balance-v2-D20` là ca thật, và nó là hình ảnh thu nhỏ của cả vấn đề
     * founder nêu: hai TRỤC KHÁC NHAU dính làm một chuỗi. Tệ hơn — D-số ĐỔI
     * ĐƯỢC (D145→D146, D191→D192 đều đã xảy ra vì hai cửa sổ va nhau), nên một
     * chuỗi phiên bản nhúng D-số có thể trỏ tới một quyết định không còn tên đó.
     */
    const pham: string[] = [];
    for (const f of nguon()) {
      const src = doc(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const m of src.matchAll(
        /export\s+const\s+[A-Z][A-Z0-9_]*(?:VERSION|PHIEN_BAN)[A-Z0-9_]*\s*=\s*'([^']+)'/g)) {
        const gt = m[1]!;
        if (/-D\d+/.test(gt) && !MIEN_TRU_DANG.has(gt)) pham.push(`${gt} (${f})`);
      }
    }
    expect(pham, 'chuỗi phiên bản mới nhúng D-số').toEqual([]);
  });

  it('trục MỚI phải theo `<miền>-v<N>[-biệt danh]`', () => {
    const pham: string[] = [];
    for (const f of nguon()) {
      const src = doc(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const m of src.matchAll(
        /export\s+const\s+[A-Z][A-Z0-9_]*(?:VERSION|PHIEN_BAN)[A-Z0-9_]*\s*=\s*'([^']+)'/g)) {
        const gt = m[1]!;
        if (!MIEN_TRU_DANG.has(gt) && !DANG_CHUAN.test(gt)) pham.push(`${gt} (${f})`);
      }
    }
    expect(pham, 'chuỗi phiên bản mới sai định dạng — thêm vào MIEN_TRU_DANG là một QUYẾT ĐỊNH, không phải một cú sửa test')
      .toEqual([]);
  });

  it('bộ miễn trừ không phình âm thầm', () => {
    // Miễn trừ là NỢ. Con số này chỉ được GIẢM. Tăng nó tức là vừa thêm một
    // chuỗi sai chuẩn nữa vào dữ liệu prod — phải là quyết định có người đọc.
    expect(MIEN_TRU_DANG.size).toBeLessThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Bản phát hành tách khỏi hai trục kia', () => {
  it('số bản phát hành có dạng MÙA.BẢN và khớp MUA', () => {
    expect(BAN_PHAT_HANH).toMatch(/^\d+\.\d+\.\d+$/);
    expect(BAN_PHAT_HANH.startsWith(`${MUA}.`)).toBe(true);
  });

  it('/health khai CẢ HAI số — bản máy chủ và bản phát hành', () => {
    /*
     * ⚠ Bài này kiểm NGUỒN, không kiểm runtime (đường HTTP của /health đã có
     * `admin_2fa.test.ts` phủ). Nó canh đúng một điều: đừng ai gỡ mất số phát
     * hành khỏi /health — vì đó là chỗ DUY NHẤT hỏi được "prod đang chạy đợt
     * nào" mà không phải đi đoán từ git.
     */
    const src = doc('server/app.ts');
    expect(src).toMatch(/version:\s*API_VERSION/);
    expect(src).toMatch(/ban_phat_hanh:\s*BAN_PHAT_HANH/);
  });
});
