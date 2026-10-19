/**
 * CHỤP GOLDEN FIXTURE cho gate 7.1 — regression tất định của bộ sinh map.
 *
 * Bối cảnh (docs/thiet-ke-da-chot/03-chu-ky-tin-dung.md §0.2): thay "túi bốc
 * ngẫu nhiên" bằng máy trạng thái chu kỳ tín dụng, BƯỚC MỘT bắt buộc là engine
 * mới cho output BYTE-HỆT engine cũ trên cùng seed. Fixture này chụp từ engine
 * TRƯỚC refactor (commit 09a37bc) và đóng băng trong repo — test
 * holdem_map_regression.test.ts so mọi bản sinhMap tương lai với nó.
 *
 * ⚠ KHÔNG chạy lại script này sau khi refactor để "cập nhật" fixture — làm thế
 * là tự xoá chính cái thước. Chỉ chạy lại khi một balance_version MỚI cố ý đổi
 * phân phối, và khi đó fixture cũ vẫn giữ cho version cũ.
 *
 * Chạy: npx tsx scripts/holdem_map_golden.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { sinhMap } from '../server/holdem/map.js';

/** FNV-1a 32-bit — đủ cho vai trò "phát hiện lệch", không phải mật mã. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const SIZES = [8, 12, 16] as const;
const DEEP_SEEDS = [1, 7, 42, 1337, 65537, 999_983, 2_147_000_001, 3_999_999_999];
const SWEEP_N = 600;

const deep = SIZES.flatMap((size) => DEEP_SEEDS.map((seed) => ({
  seed, size, o: sinhMap(seed, size).o,
})));

const sweep = Object.fromEntries(SIZES.map((size) => {
  let acc = '';
  for (let seed = 0; seed < SWEEP_N; seed += 1) {
    acc += JSON.stringify(sinhMap(seed, size).o);
  }
  return [String(size), fnv1a(acc)];
}));

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync(
  'tests/fixtures/holdem_map_golden.json',
  JSON.stringify({ chup_tai_commit: '09a37bc', sweep_n: SWEEP_N, sweep, deep }),
);
console.log('✓ golden:', deep.length, 'map deep-equal +', SWEEP_N, 'seed sweep/size —', JSON.stringify(sweep));
