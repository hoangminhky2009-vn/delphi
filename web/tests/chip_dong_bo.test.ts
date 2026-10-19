/**
 * ĐÀN CHIP BAY ↔ CỌC ĐÍCH — hai nhịp phải khớp.
 *
 * Founder 31/08: *"hiệu ứng đặt cược chip đang bị khựng/ lệch timeline"*.
 *
 * Đo trên stack (ordering, không phải timing): cọc đích mọc TRONG CÙNG lượt
 * render với lúc `bayChip()` tạo đàn chip — sample đầu tiên sau cú chạm lá đã
 * thấy `cocChip: 2` và `bay: 2` cùng lúc. Rồi chip mất 260ms mới tới nơi ⇒ chip
 * lao về một cái cọc ĐÃ đầy.
 *
 * ⚠ KHÔNG đo được THỜI GIAN trong môi trường này: pane trình duyệt chạy ẩn
 * (`document.hidden = true`) nên `document.timeline` đứng yên — mọi con số ms
 * quan sát được đều là hiện vật của đồng hồ chết. Nên bài này canh THỨ TỰ và
 * MỘT NGUỒN, là hai thứ đọc được từ mã nguồn.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const ma = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('I. Một nguồn cho thời lượng bay', () => {
  it('⭐⭐ `bayChip` và cọc đích đọc CÙNG một con số', () => {
    /*
     * Hai bản của cùng một thời lượng sẽ trôi (D61), và cú trôi ở đây biểu hiện
     * ĐÚNG BẰNG lỗi đang sửa: cọc mọc lệch pha với đàn chip.
     */
    expect(ma(doc('src/lib/nhip.ts')), 'nhip.ts thiếu CHIP_BAY').toContain('CHIP_BAY');
    expect(ma(doc('src/lib/nhip.ts')), 'nhip.ts chưa bơm --nhip-chip-bay')
      .toContain("'--nhip-chip-bay'");
    expect(ma(doc('src/components/holdem/ShopManHinh.tsx')), 'bayChip gõ số trần thay vì đọc hằng')
      .toContain('NHIP.CHIP_BAY');
    expect(ma(doc('src/components/holdem/CocChip.module.css')), 'cọc đích gõ số trần')
      .toContain('--nhip-chip-bay');
  });
});

describe('II. Chỉ nhóm VỪA XẾP mới chờ', () => {
  const CSS = doc('src/components/holdem/CocChip.module.css');

  it('⭐ `.cho`/`.khg` có độ trễ; `.chip` trần thì KHÔNG', () => {
    /*
     * `.chip` trần là chip ĐANG GIỮ từ vòng trước — nó không bay đi đâu cả.
     * Cho nó trễ là làm cọc cũ nháy vô cớ mỗi lần cọc render lại.
     */
    const i = ma(CSS).indexOf('.cho,');
    expect(i, 'mất quy tắc trễ của nhóm vừa xếp').toBeGreaterThan(-1);
    const luat = ma(CSS).slice(i, ma(CSS).indexOf('}', i));
    expect(luat).toContain('animation');

    const j = ma(CSS).indexOf('.chip {');
    const chipTran = ma(CSS).slice(j, ma(CSS).indexOf('}', j));
    expect(chipTran, 'chip ĐANG GIỮ không được trễ — nó có bay đâu mà chờ')
      .not.toContain('animation');
  });

  it('giữ khung đầu trong lúc trễ (`both`) — không thì thêm một cú nháy nữa', () => {
    const i = ma(CSS).indexOf('.cho,');
    const luat = ma(CSS).slice(i, ma(CSS).indexOf('}', i));
    expect(luat, 'thiếu `both`: chip hiện ngay rồi mới co lại').toMatch(/\bboth\b/);
  });
});

describe('III. Tiết kiệm chuyển động: bỏ trễ, vì lúc đó KHÔNG có chip nào bay', () => {
  it('⭐⭐ reduced-motion phải gỡ cả độ trễ, không chỉ gỡ hoạt ảnh', () => {
    /*
     * `bayChip()` return NGAY khi `prefers-reduced-motion` — không tạo con chip
     * nào. Giữ độ trễ lúc ấy là bắt cọc chờ một đàn chip KHÔNG TỒN TẠI: chip
     * hiện muộn 260ms không vì lý do gì. Đây là ca áp D116 máy móc sẽ ra kết quả
     * tệ hơn không áp.
     */
    const CSS = doc('src/components/holdem/CocChip.module.css');
    const i = CSS.indexOf('prefers-reduced-motion');
    expect(i, 'CocChip chưa có lưới tắt').toBeGreaterThan(-1);
    /*
     * ⚠ PHẢI CẮT ĐÚNG THÂN KHỐI @media, không cắt tới hết file. Bản đầu của bài
     * này cắt `CSS.slice(i)` và nó XANH GIẢ: rule `.cho { background }` nằm ngay
     * SAU khối tắt nên chuỗi `.cho` vẫn khớp dù khối tắt đã mất `.cho`. Mũi tiêm
     * "reduced-motion thôi phủ .cho" đi lọt, và chỉ lộ khi tiêm mới biết.
     * Đếm ngoặc để lấy đúng thân: @media mở 1, mỗi rule con mở/đóng 1.
     */
    let sau = i;
    let mo = 0;
    let het = -1;
    for (let k = CSS.indexOf('{', i); k < CSS.length && k > -1; k++) {
      if (CSS[k] === '{') mo++;
      else if (CSS[k] === '}') { mo--; if (mo === 0) { het = k; break; } }
    }
    expect(het, 'không đóng được khối @media — đọc lại file').toBeGreaterThan(-1);
    const khoi = CSS.slice(sau, het);
    expect(khoi, 'khối tắt không nhắc `.cho` — nhóm vừa xếp vẫn bị trễ vô cớ').toContain('.cho');
    expect(khoi, 'phải tắt hẳn animation (kèm cả delay), không được để lại trễ')
      .toContain('animation: none');

    // và `bayChip` đúng là có return sớm — nếu không thì lý lẽ trên sai
    const tsx = ma(doc('src/components/holdem/ShopManHinh.tsx'));
    const k = tsx.indexOf('function bayChip');
    expect(tsx.slice(k, k + 700), 'bayChip không còn thoát sớm ở reduced-motion — xét lại khối trên')
      .toContain('prefers-reduced-motion');
  });
});
