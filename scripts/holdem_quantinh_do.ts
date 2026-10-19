/**
 * ĐO QUÁN TÍNH (D43 bước 3, gate 7.5) — chạy lại được: autocorr lag-1 của dãy
 * hướng pha (cũ vs v12) + phân vị chuỗi TĂNG dài nhất mỗi map (founder chốt
 * hazard tự nhiên, MC phải báo p99,9 — Q3 doc 03 §6).
 * Chạy: npx tsx scripts/holdem_quantinh_do.ts
 */
import { sinhMap } from '../server/holdem/map.js';

const HUONG = { tang: 1, phuc_hoi: 1, giam: -1, di_ngang: 0, bien_dong: 0 } as const;
const N = 20000;

function doMot(quanTinh: boolean): void {
  const x: number[] = [];
  const y: number[] = [];
  const maxTang: number[] = [];
  const maxGiam: number[] = [];
  for (let seed = 1; seed <= N; seed += 1) {
    const day = sinhMap(seed, 12, { quanTinh }).o
      .filter((o) => o.kind === 'giai_doan')
      .map((o) => (o.kind === 'giai_doan' ? HUONG[o.giai_doan] : 0));
    for (let i = 0; i + 1 < day.length; i += 1) { x.push(day[i]!); y.push(day[i + 1]!); }
    let mt = 0; let mg = 0; let ct = 0; let cg = 0;
    for (const h of day) {
      ct = h === 1 ? ct + 1 : 0; cg = h === -1 ? cg + 1 : 0;
      mt = Math.max(mt, ct); mg = Math.max(mg, cg);
    }
    maxTang.push(mt); maxGiam.push(mg);
  }
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let cov = 0; let vx = 0; let vy = 0;
  for (let i = 0; i < x.length; i += 1) {
    cov += (x[i]! - mx) * (y[i]! - my); vx += (x[i]! - mx) ** 2; vy += (y[i]! - my) ** 2;
  }
  const pct = (arr: number[], q: number) => {
    const s2 = [...arr].sort((a, b) => a - b);
    return s2[Math.min(s2.length - 1, Math.floor(q * s2.length))];
  };
  console.log(`${quanTinh ? 'v12 quán tính' : 'engine cũ   '} — autocorr ${
    (cov / Math.sqrt(vx * vy)).toFixed(3)} | chuỗi TĂNG max/map p50=${pct(maxTang, 0.5)} p95=${
    pct(maxTang, 0.95)} p99,9=${pct(maxTang, 0.999)} | chuỗi GIẢM p95=${pct(maxGiam, 0.95)} p99,9=${pct(maxGiam, 0.999)}`);
}
doMot(false);
doMot(true);
