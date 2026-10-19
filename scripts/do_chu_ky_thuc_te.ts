/**
 * ĐO CHU KỲ THỰC TẾ — bản đang chạy vs cổng `balance-v39-thucte` vs MỤC TIÊU có nguồn (D301).
 *
 * Chạy: npx tsx scripts/do_chu_ky_thuc_te.ts [số_seed=3000] [ver1,ver2,...]
 *
 * Mỗi dòng mục tiêu ghi NGUỒN + QUY ĐỔI ngay cạnh số (toàn văn ở
 * docs/thiet-ke-de-xuat/gameplay/chu-ky-thuc-te-nguon-va-quy-doi.md). Thang: 1 ô = 6 tháng.
 * Script chỉ ĐỌC engine; không ghi gì. Đây là thước để founder chốt lật v39 (A8.2).
 */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';

const N = Math.max(200, Number(process.argv[2] ?? 3000) | 0);
const VERS = (process.argv[3] ?? `${HOLDEM_BALANCE_VERSION},balance-v38-doixung,balance-v39-thucte`).split(',');
const SIZES = [8, 12, 16] as const;

interface Do {
  hazardTang: number;      // P(chuỗi TĂNG gãy ở ô kế | chuỗi đang sống, còn ô)
  daiGiam: number;         // độ dài TB chuỗi GIẢM (chỉ chuỗi đã kết thúc trong map)
  moLen: number;           // P(mở LÊN | từ nền ngang mở hướng)
  giaDonDoc: number;       // tỷ lệ tin GIẢ trong tin đơn độc
  giaNoiChuoi: number;     // tỷ lệ tin GIẢ trong tin nối chuỗi
  bbVo4: number;           // P(có GIẢM trong 4 ô = 2 năm sau ô bong bóng THẬT — cửa sổ GSY; v27 không ép ô nào)
  tang: number; giam: number; ngang: number; bd: number; ph: number; tin: number;
  chuoiPhaTB: number;      // độ dài TB chuỗi pha kề thật (ô công bố)
}

function doMot(ver: string, size: number): Do {
  const tc = tuyChonSinhMap(luatCua(ver));
  let songTang = 0, gayTang = 0;
  let giamRuns = 0, giamTong = 0;
  let mo = 0, moLen = 0;
  let donDoc = 0, donDocGia = 0, noiChuoi = 0, noiChuoiGia = 0;
  let bb = 0, bbVo = 0;
  const dem = { tang: 0, giam: 0, di_ngang: 0, bien_dong: 0, phuc_hoi: 0, tin: 0 } as Record<'tang' | 'giam' | 'di_ngang' | 'bien_dong' | 'phuc_hoi' | 'tin', number>;
  let tong = 0, capKe = 0, doiKe = 0, run = 1, soRun = 0, runTong = 0;
  for (let s = 1; s <= N; s++) {
    const m = sinhMap((s * 2654435761) >>> 0, size, tc);
    const o = m.o as any[];
    const tt = m.trang_thai as any[];
    for (let i = 0; i < o.length; i++) {
      tong++;
      if (o[i].kind === 'su_kien') {
        dem.tin++;
        if (o[i].boi_canh === 'don_doc') { donDoc++; if (o[i].la_tin_gia) donDocGia++; }
        else { noiChuoi++; if (o[i].la_tin_gia) noiChuoiGia++; }
        if (o[i].su_kien === 'bong_bong' && !o[i].la_tin_gia) {
          bb++;
          // Ô bong bóng = lúc GSY "nhận ra đợt tăng 100%"; v27 không ép ô nào sau đó ⇒ cửa sổ
          // sập 2 năm = 4 ô kế (+1..+4). Không đủ cửa sổ thì không đếm.
          if (i + 4 < o.length) {
            if (o.slice(i + 1, i + 5).some((x) => x.kind === 'giai_doan' && x.giai_doan === 'giam')) bbVo++;
          } else bb--;
        }
      } else {
        dem[o[i].giai_doan as 'tang' | 'giam' | 'di_ngang' | 'bien_dong' | 'phuc_hoi'] += 1;
      }
      // Chuỗi pha kề thật (ô công bố)
      if (i > 0 && o[i].kind === 'giai_doan' && o[i - 1].kind === 'giai_doan') {
        capKe++;
        if (o[i].giai_doan !== o[i - 1].giai_doan) { doiKe++; soRun++; runTong += run; run = 1; } else run++;
      }
      // Máy nền: run_huong/run_dai ghi SAU ô i (trạng thái sau khi tính ô).
      if (tt && i + 1 < tt.length && o[i].kind === 'giai_doan' && o[i + 1].kind === 'giai_doan') {
        const a = tt[i], b = tt[i + 1];
        if (a.run_huong === 1) { songTang++; if (b.run_huong !== 1) gayTang++; }
        if (a.run_huong === 0 && b.run_huong !== 0) { mo++; if (b.run_huong === 1) moLen++; }
      }
    }
    soRun++; runTong += run; run = 1;
    // Chuỗi GIẢM đã kết thúc: đọc từ run_dai lúc run_huong đổi khỏi -1.
    if (tt) {
      for (let i = 1; i < tt.length; i++) {
        if (tt[i - 1].run_huong === -1 && tt[i].run_huong !== -1) { giamRuns++; giamTong += tt[i - 1].run_dai; }
      }
    }
  }
  const pha = tong - dem.tin;
  return {
    hazardTang: gayTang / Math.max(1, songTang),
    daiGiam: giamTong / Math.max(1, giamRuns),
    moLen: moLen / Math.max(1, mo),
    giaDonDoc: donDocGia / Math.max(1, donDoc),
    giaNoiChuoi: noiChuoiGia / Math.max(1, noiChuoi),
    bbVo4: bbVo / Math.max(1, bb),
    tang: dem.tang / pha, giam: dem.giam / pha, ngang: dem.di_ngang / pha,
    bd: dem.bien_dong / pha, ph: dem.phuc_hoi / pha, tin: dem.tin / tong,
    chuoiPhaTB: runTong / Math.max(1, soRun),
  };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const MUC_TIEU: { ten: string; khoa: keyof Do; muc: string; nguon: string }[] = [
  { ten: 'Hazard chuỗi TĂNG /ô', khoa: 'hazardTang', muc: '18–30%', nguon: 'bull TB 2,7 năm = 5,4 ô ⇒ 1/5,4 = 18,5% (Hartford Funds); cộng phụ phí ngược tiền/telegraph' },
  { ten: 'Độ dài chuỗi GIẢM (ô)', khoa: 'daiGiam', muc: '1,4–1,9', nguon: 'bear TB 9,6 tháng = 1,6 ô (Hartford); contraction NBER 10,3 tháng' },
  { ten: 'Mở LÊN từ ngang', khoa: 'moLen', muc: '58–72%', nguon: 'S&P dương 65% số tháng (Crestmont)' },
  { ten: 'Tin GIẢ trong tin đơn độc', khoa: 'giaDonDoc', muc: '55–75%', nguon: 'Ahern & Sosyura 2015: 33% tin đồn thành thật ⇒ 67% giả' },
  { ten: 'Bong bóng thật VỠ trong 2 năm (4 ô)', khoa: 'bbVo4', muc: '45–70%', nguon: 'Greenwood–Shleifer–You 2019: 21/40 = 53% sập ≥40% trong 2 năm sau khi nhận ra đợt tăng 100% (rẻ 53% · trung tính 68% · đắt 82%)' },
  { ten: 'Ô TĂNG / ô pha', khoa: 'tang', muc: '≥ ô GIẢM', nguon: 'thị trường có drift dương; 65% tháng dương' },
];

console.log(`N = ${N} seed/cỡ · 1 ô = 6 tháng · thang mục tiêu có nguồn (docs/thiet-ke-de-xuat/gameplay/chu-ky-thuc-te-nguon-va-quy-doi.md)\n`);
for (const size of SIZES) {
  console.log(`── MAP ${size} ──`);
  const rows = VERS.map((v) => ({ v, d: doMot(v, size) }));
  const head = ['chỉ số'.padEnd(30), ...rows.map((r) => r.v.padEnd(24)), 'mục tiêu'.padEnd(10), 'nguồn'].join(' ');
  console.log(head);
  for (const m of MUC_TIEU) {
    const cells = rows.map((r) => {
      const x = r.d[m.khoa];
      return (m.khoa === 'daiGiam' || m.khoa === 'chuoiPhaTB' ? x.toFixed(2) : pct(x)).padEnd(24);
    });
    console.log([m.ten.padEnd(30), ...cells, m.muc.padEnd(10), m.nguon].join(' '));
  }
  for (const r of rows) {
    const d = r.d;
    console.log(`  ${r.v}: pha tăng ${pct(d.tang)} · giảm ${pct(d.giam)} · ngang ${pct(d.ngang)} · biến động ${pct(d.bd)} · phục hồi ${pct(d.ph)} · ô tin ${pct(d.tin)} · tin nối chuỗi giả ${pct(d.giaNoiChuoi)} · chuỗi pha kề TB ${d.chuoiPhaTB.toFixed(2)} ô`);
  }
  console.log('');
}
