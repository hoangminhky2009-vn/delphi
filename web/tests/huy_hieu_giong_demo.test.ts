/**
 * ART HUY HIỆU + STICKER == DEMO ĐÃ DUYỆT, TỪNG Ô (SPEC huy-hieu-hang-sticker 5b.1 · A11.25: demo là nguồn chân lý).
 *
 * `web/src/lib/huy_hieu.ts` là bản TS của hàm `huyHieu` (v4) + bảng `KL` + dữ liệu `STK` trong
 * `docs/ui-ux/demo/hub-tang-khong-gian.html`. Chép tay một hàm vẽ 70 dòng là chỗ trôi lặng lẽ nhất (một dấu `-`, một
 * `Math.round` sai nửa ô cũng ra hình khác mà mắt không thấy ngay). Bài này CHẠY CHÍNH hàm của demo (nạp bằng `vm`)
 * rồi so từng ô màu với bản app — bảy huy hiệu và sáu sticker. Founder sửa demo ⇒ bài đỏ ⇒ sửa app cho khớp (hoặc
 * ngược lại, có chủ đích), không còn trôi.
 *
 * Tiêm ngược đã chạy (xem báo cáo): đổi `0.92` → `0.8` ở nhánh `khien` ⇒ đỏ đúng bậc BẠC (chỉ số 2); đổi một ô của lưới Cá Ngựa ⇒ đỏ sticker.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { cumSticker, luoiHuyHieu, STICKER_HANG } from '@/lib/huy_hieu';

const HTML = readFileSync(join(process.cwd(), '..', 'docs/ui-ux/demo/hub-tang-khong-gian.html'), 'utf8');

interface HamDemo {
  huyHieu: (t: number, size: number) => string;
  veSticker: (key: string, size: number) => string;
}
const demo: HamDemo = (() => {
  const khoi = (re: RegExp, ten: string) => {
    const m = HTML.match(re);
    if (!m) throw new Error(`không tìm thấy ${ten} trong demo — demo đổi cấu trúc?`);
    return m[0];
  };
  const ma = [
    khoi(/const KL=\[[\s\S]*?\];\r?\nfunction huyHieu\(t,size\)\{[\s\S]*?\r?\n\}\r?\n/, 'KL + huyHieu'),
    khoi(/const STK=\{[\s\S]*?\r?\n\};/, 'STK'),
    khoi(/function veSticker\(key,size\)\{[\s\S]*?\r?\n\}\r?\n/, 'veSticker'),
    'out={huyHieu,veSticker};',
  ].join('\n');
  const ctx: { out?: HamDemo } = {};
  vm.runInNewContext(ma, ctx);
  return ctx.out!;
})();

/** SVG của demo → bản đồ ô "x,y" → màu. Mỗi `<rect>` của demo là đúng một ô (rộng 1,02). */
function oCuaDemo(svg: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="1\.02" fill="(#[0-9a-fA-F]+)"\/>/g)) {
    const w = Math.round(parseFloat(r[3]!) - 0.02);
    for (let i = 0; i < w; i += 1) m.set(`${parseFloat(r[1]!) + i},${r[2]}`, r[4]!.toLowerCase());
  }
  return m;
}
function soSanh(a: Map<string, string>, b: Map<string, string>): string[] {
  const lech: string[] = [];
  for (const [k, v] of a) if (b.get(k) !== v) lech.push(`${k}: demo ${v} ≠ app ${b.get(k) ?? '∅'}`);
  for (const k of b.keys()) if (!a.has(k)) lech.push(`${k}: app thừa`);
  return lech;
}

describe('art == demo, từng ô', () => {
  it('⭐ bảy huy hiệu: không lệch ô nào', () => {
    for (let t = 0; t < 7; t += 1) {
      const demoO = oCuaDemo(demo.huyHieu(t, 40));
      const app = new Map<string, string>();
      luoiHuyHieu(t).forEach((hang, y) => hang.forEach((c, x) => { if (c) app.set(`${x},${y}`, c.toLowerCase()); }));
      expect(demoO.size, `demo bậc ${t} trống?`).toBeGreaterThan(50);
      expect(soSanh(demoO, app).slice(0, 5), `bậc ${t}`).toEqual([]);
    }
  });

  it('⭐ sáu sticker: không lệch ô nào (dáng · cỡ · màu hình mẫu)', () => {
    const khoa: Record<string, string> = {
      tom: 'st_hh_tom', cua: 'st_hh_cua', ca_ngua: 'st_hh_ca_ngua',
      ca_duoi: 'st_hh_ca_duoi', ca_map: 'st_hh_ca_map', ca_voi_vang: 'st_hh_ca_voi',
    };
    for (const [k, id] of Object.entries(khoa)) {
      const demoO = oCuaDemo(demo.veSticker(k, 40));
      const app = new Map<string, string>();
      for (const o of cumSticker(STICKER_HANG[id]!).cum) {
        for (let i = 0; i < o.w; i += 1) app.set(`${o.x + i},${o.y}`, o.fill.toLowerCase());
      }
      expect(demoO.size, `demo ${k} trống?`).toBeGreaterThan(20);
      expect(soSanh(demoO, app).slice(0, 5), k).toEqual([]);
    }
  });
});
