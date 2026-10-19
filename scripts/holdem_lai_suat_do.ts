/**
 * ĐO PHÂN BỐ LÃI SUẤT NỀN (v26) — đường tái lập cho các ngưỡng trong
 * `LAI_SUAT_NEN`.
 *
 * ⚠ VÌ SAO PHẢI CÓ FILE NÀY: hai mốc `NGUONG_THAP`/`NGUONG_CAO` được đặt TỪ SỐ
 * ĐO, không từ trực giác — và bản đầu đặt sai (250/600) khiến môi trường "tiền
 * đắt" xảy ra 0,0% trên 3.000 map, tức một cơ chế xây xong rồi không bao giờ
 * chạy. D57 đã trả giá một lần cho việc để lại một ĐƯỜNG DẪN CHẾT trong chú
 * thích của bảng số kinh tế; đây là chỗ trả nốt.
 *
 * ⚠ Đổi `huongChinhSachKyVong`, `LICH_CHINH_SACH`, hay `BUOC_KY_HOP` thì bảng
 * ngưỡng SAI NGAY và sai IM LẶNG — chạy lại file này mỗi lần chạm một trong ba.
 *
 * Chạy:  npx tsx scripts/holdem_lai_suat_do.ts [soSeed]
 */
import { sinhMap } from '../server/holdem/map.js';
import { LAI_SUAT_NEN, moiTruongTienTe } from '../config/holdem.js';

const SO_SEED = Number(process.argv[2] ?? 3000);
const CO = { lich: true, quanTinh: true, sucCang: true, chuKy: true,
  duoiTelegraph: true, duoi5: false, laiSuatNen: true } as const;
for (const size of [8, 12, 16]) {
  const dem: Record<string, number> = {};
  const huong: Record<string, number> = {};
  let min = 1e9, max = -1e9;
  for (let seed = 1; seed <= SO_SEED; seed += 1) {
    const m = sinhMap(seed, size, CO);
    for (const t of m.trang_thai!) {
      const d = t.lai_suat_diem;
      min = Math.min(min, d); max = Math.max(max, d);
      const b = Math.floor(d / 50) * 50;
      dem[b] = (dem[b] ?? 0) + 1;
      if (t.o_lich) huong[t.huong_cs_thuc!] = (huong[t.huong_cs_thuc!] ?? 0) + 1;
    }
  }
  const tong = Object.values(dem).reduce((a, b) => a + b, 0);
  const mt: Record<string, number> = { re: 0, trung_tinh: 0, dat: 0 };
  for (const [k, n] of Object.entries(dem)) mt[moiTruongTienTe(Number(k))]! += n;
  console.log(`\n=== map ${size} · min ${min} max ${max} ===`);
  console.log('hướng kỳ họp:', JSON.stringify(huong));
  console.log(`môi trường: rẻ ${(mt.re! * 100 / tong).toFixed(1)}%`
    + ` · trung tính ${(mt.trung_tinh! * 100 / tong).toFixed(1)}%`
    + ` · đắt ${(mt.dat! * 100 / tong).toFixed(1)}%`
    + `   (ngưỡng ${LAI_SUAT_NEN.NGUONG_THAP}/${LAI_SUAT_NEN.NGUONG_CAO})`);
  for (const k of Object.keys(dem).map(Number).sort((a, b) => a - b)) {
    console.log(`  ${String(k).padStart(4)}  ${(dem[k]! * 100 / tong).toFixed(1)}%`);
  }
}
