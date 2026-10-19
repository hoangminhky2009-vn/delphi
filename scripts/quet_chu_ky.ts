/**
 * QUÉT BỘ SỐ CHU KỲ VĨ MÔ — đo `sinhMap` dưới nhiều bộ số máy tick, CHỈ ĐỌC.
 *
 * Founder 22/09: *"cơ chế sinh seed trong trận bình thường bị làm sao ấy, t chơi loạn v** và
 * chẳng thấy rõ chu kỳ nào, cảm giác loạn chứ không phải 1 chu kỳ vĩ mô"*. `do_chu_ky.ts` đo ra
 * chuỗi cùng pha 1,43 ô; file này trả lời câu kế tiếp: **bộ số nào kéo nó lên, và đổi lại mất gì.**
 *
 * ─── CÁCH GHI ĐÈ (không sửa một dòng config) ───────────────────────────────────────────────
 * `sinhMap` đọc bộ số máy tick qua `thamSoTick(chuKyThucTe)` MỖI LẦN GỌI, và object đó là một
 * object thường (`as const` chỉ là kiểu, không `Object.freeze`). Nên script ghi đè NGAY TRONG
 * PROCESS này rồi đọc lại từng khoá để chứng minh cần gạt sống (bẫy D58: dò trên hằng số chết là
 * phép rỗng in ra số đẹp). Config trên đĩa không đổi; process khác không thấy gì.
 * ⚠ Ngày ai đó `Object.freeze` bộ số: phép gán ném TypeError (module ES chạy strict) — hỏng TO,
 * không hỏng câm. Đúng kiểu hỏng mong muốn.
 *
 * ─── KHÔNG PHẢI GATE ───────────────────────────────────────────────────────────────────────
 * Đây là thước HÌNH DẠNG map (mắt người đọc ra chu kỳ không). Nó không nói gì về cân bằng
 * G1–G5 — bộ nào founder chọn vẫn phải qua `scripts/holdem_montecarlo.ts` ba cỡ bàn, và qua
 * `balance_version` mới (A11.3). Đổi bộ số máy tick là ĐỔI BÀN TẬP (seed ghim phụ thuộc nó —
 * docstring `MAN_TAP_SEED_THUC_TE`): quét lại seed là bước cuối của lượt lật.
 *
 * CHẠY:
 *   npx tsx scripts/quet_chu_ky.ts [số_map=4000] [cỡ_bàn=12] [--bo=goc,A,B,C] [--mau=3]
 *   npx tsx scripts/quet_chu_ky.ts 4000 12 --don-le        (độ nhạy: đổi MỘT cần gạt mỗi dòng)
 *   npx tsx scripts/quet_chu_ky.ts 4000 12 --phien-ban=balance-v52-dadang
 * Hạt giống giống hệt `do_chu_ky.ts` (s × 7919 + 13) ⇒ hàng `goc` phải ra ĐÚNG số của nó.
 */
import { HUONG_GIAI_DOAN, sinhMap, type HoldemMap, type OThiTruong } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import {
  HOLDEM_BALANCE_VERSION, LICH_CHINH_SACH, luatCua, thamSoTick, type GiaiDoanId, type ThamSoTick,
} from '../config/holdem.js';

// ─── tham số dòng lệnh ────────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const VT = ARGV.filter((x) => !x.startsWith('--'));
const co = (ten: string): string | undefined =>
  ARGV.find((x) => x.startsWith(`--${ten}=`))?.slice(ten.length + 3);
const N = Math.max(1, Number(VT[0] ?? 4000) | 0);
const SIZE = Math.max(4, Number(VT[1] ?? 12) | 0);
const PHIEN_BAN = co('phien-ban') ?? HOLDEM_BALANCE_VERSION;
const SO_MAU = Math.max(0, Number(co('mau') ?? 3) | 0);
const DON_LE = ARGV.includes('--don-le');
/** Một dòng mỗi bộ — dùng khi quét nhiều tổ hợp. */
const GON = ARGV.includes('--gon');
/** Bộ `thu` đọc ô kỳ họp GIỮ theo mặt xu hướng (ƯỚC LƯỢNG, xem `kyHopTheoXuHuong`). */
const KY_HOP_TAY = ARGV.includes('--ky-hop-xu-huong');
/** `--ghi=MAT_THUAN_BP:9000,MAT_NGHI_BP:600` — thử một tổ hợp tuỳ ý (bộ `thu`). */
const GHI_TAY: Record<string, number> = Object.fromEntries(
  (co('ghi') ?? '').split(',').filter(Boolean).map((cap) => {
    const [k, v] = cap.split(':');
    const n = Number(v);
    if (!k || !Number.isInteger(n)) throw new Error(`--ghi hỏng ở "${cap}" (cần KHOÁ:số_nguyên)`);
    return [k, n];
  }),
);

const LUAT = luatCua(PHIEN_BAN);
if (!LUAT.regimeTick) {
  throw new Error(`${PHIEN_BAN} không bật máy tick (regimeTick) — bộ số dưới đây không chạm được map.`);
}
const TC = tuyChonSinhMap(LUAT);
/** ĐÚNG object `sinhMap` đọc cho phiên bản này — không phải bản chép. */
const RT = thamSoTick(LUAT.chuKyThucTe === true) as unknown as Record<string, number>;
const GOC: Readonly<Record<string, number>> = Object.freeze({ ...RT });

type Khoa = keyof ThamSoTick;
type GhiDe = Partial<Record<Khoa, number>>;

// ─── BỘ SỐ ────────────────────────────────────────────────────────────────────────────────
interface BoSo {
  ma: string;
  ten: string;
  /** Một câu: bộ này đổi lớp nào của máy. */
  y: string;
  ghiDe: GhiDe;
  /**
   * ƯỚC LƯỢNG biến thể CẤU TRÚC "ô kỳ họp GIỮ giữa một xu hướng lật MẶT của xu hướng" (thay vì
   * ĐI NGANG). Máy tick KHÔNG có cần gạt nào cho việc này — nó là một dòng trong nhánh `thuc ===
   * 'giu'` của `sinhMap`. Script dán lại nhãn ô SAU khi sinh map; bỏ qua đúng một hiệu ứng dây
   * chuyền: mặt TĂNG nạp sức căng còn ĐI NGANG xả (capNhatS) ⇒ hazard về sau lệch rất nhẹ. Số
   * chính xác đo bằng bản vá tạm ghi trong đề xuất (docs/thiet-ke-de-xuat/gameplay/).
   */
  kyHopTheoXuHuong?: boolean;
}

const BO: readonly BoSo[] = [
  { ma: 'goc', ten: 'ĐANG CHẠY', y: 'bộ số v53 trên prod, không đổi gì', ghiDe: {} },
  { ma: 'thu', ten: 'THỬ TAY', y: 'tổ hợp từ --ghi=', ghiDe: GHI_TAY as GhiDe, ...(KY_HOP_TAY ? { kyHopTheoXuHuong: true } : {}) },
];

function apDung(g: GhiDe): void {
  for (const k of Object.keys(RT)) RT[k] = GOC[k]!;
  for (const [k, v] of Object.entries(g)) {
    if (!(k in GOC)) throw new Error(`khoá lạ "${k}" — không có trong bộ số máy tick`);
    RT[k] = v as number;
  }
  // Đọc lại QUA ĐÚNG CỬA sinhMap dùng — cần gạt chết thì dừng ở đây, không in số đẹp.
  const doc = thamSoTick(LUAT.chuKyThucTe === true) as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(g)) {
    if (doc[k] !== v) throw new Error(`cần gạt ${k} CHẾT: ghi ${v}, sinhMap đọc ${doc[k]}`);
  }
}

// ─── ĐO ───────────────────────────────────────────────────────────────────────────────────
const PHA: readonly GiaiDoanId[] = ['tang', 'di_ngang', 'giam', 'bien_dong', 'phuc_hoi'];
const huong = (p: GiaiDoanId): -1 | 0 | 1 => HUONG_GIAI_DOAN[p];

interface KetQua {
  soBan: number;
  dem: Record<GiaiDoanId, number>;
  chuyen: Record<GiaiDoanId, Record<GiaiDoanId, number>>;
  /** Chuỗi cùng MẶT trên dãy ô pha (bỏ ô tin) — đúng thước `do_chu_ky.ts`. */
  chuoiTong: number; chuoiSo: number;
  /** Chuỗi cùng HƯỚNG (tăng+phục hồi = lên · giảm = xuống · ngang+biến động = ngang). */
  chuoiHuongTong: number; chuoiHuongSo: number;
  doiHuong: number; capPha: number;
  /** Nền ẩn đã kết thúc trong bàn: tổng độ dài (ô pha) + số nền, theo hướng. */
  nen: Record<'len' | 'xuong' | 'ngang', { tong: number; so: number }>;
  /** Ô tick của nền SỐNG (không gãy, không bị cắt): tổng + số ô lật đúng mặt thuận. */
  songTong: number; songThuan: number;
  /** Nguồn của từng ô ĐI NGANG. */
  nguonNgang: Record<'ky_hop_giu' | 'nghi_trong_xu_huong' | 'gay_ve_ngang' | 'nen_ngang' | 'khac', number>;
  /** Hazard chuỗi TĂNG (thước D301) + mở LÊN từ ngang. */
  songTang: number; gayTang: number; mo: number; moLen: number;
  /** Theo bàn. */
  banCoPhucHoi: number; banCoGiam2: number; banMotVong: number; doiMatTong: number;
  /** Ô pha theo NHÁNH máy (suy từ nền trước/sau) + số lần ĐỔI MẶT mà ô nhánh đó gây ra. */
  nhanh: Record<Nhanh, { o: number; doi: number }>;
}

type Nhanh = 'song' | 'gay' | 'ngang' | 'cat' | 'lich' | 'ep' | 'khac';
const NHANH: readonly Nhanh[] = ['song', 'gay', 'ngang', 'cat', 'lich', 'ep', 'khac'];
const TEN_NHANH: Record<Nhanh, string> = {
  song: 'xu hướng sống', gay: 'gãy xu hướng', ngang: 'nền ngang', cat: 'tin tốt cắt chuỗi giảm',
  lich: 'kỳ họp GIỮ', ep: 'chuỗi ép (bong bóng vỡ)', khac: 'khác (chế độ bong bóng)',
};

function khoiTao(): KetQua {
  const z = (): Record<GiaiDoanId, number> => ({ tang: 0, di_ngang: 0, giam: 0, bien_dong: 0, phuc_hoi: 0 });
  return {
    soBan: 0, dem: z(),
    chuyen: { tang: z(), di_ngang: z(), giam: z(), bien_dong: z(), phuc_hoi: z() },
    chuoiTong: 0, chuoiSo: 0, chuoiHuongTong: 0, chuoiHuongSo: 0, doiHuong: 0, capPha: 0,
    nen: { len: { tong: 0, so: 0 }, xuong: { tong: 0, so: 0 }, ngang: { tong: 0, so: 0 } },
    songTong: 0, songThuan: 0,
    nguonNgang: { ky_hop_giu: 0, nghi_trong_xu_huong: 0, gay_ve_ngang: 0, nen_ngang: 0, khac: 0 },
    songTang: 0, gayTang: 0, mo: 0, moLen: 0,
    banCoPhucHoi: 0, banCoGiam2: 0, banMotVong: 0, doiMatTong: 0,
    nhanh: {
      song: { o: 0, doi: 0 }, gay: { o: 0, doi: 0 }, ngang: { o: 0, doi: 0 }, cat: { o: 0, doi: 0 },
      lich: { o: 0, doi: 0 }, ep: { o: 0, doi: 0 }, khac: { o: 0, doi: 0 },
    },
  };
}

const tenNen = (h: -1 | 0 | 1): 'len' | 'xuong' | 'ngang' => (h === 1 ? 'len' : h === -1 ? 'xuong' : 'ngang');

/** Dãy ô pha của bàn có "một vòng" đọc được: chân LÊN ≥2 → chân XUỐNG ≥2 → lại LÊN. */
function coMotVong(pha: readonly GiaiDoanId[]): boolean {
  let buoc = 0; let run = 0; let huongRun = 0;
  for (const p of pha) {
    const h = huong(p);
    if (h === huongRun && h !== 0) run += 1; else { huongRun = h; run = h === 0 ? 0 : 1; }
    if (buoc === 0 && huongRun === 1 && run >= 2) buoc = 1;
    else if (buoc === 1 && huongRun === -1 && run >= 2) buoc = 2;
    else if (buoc === 2 && huongRun === 1) return true;
  }
  return false;
}

function doMotBan(m: HoldemMap, kq: KetQua, kyHop = false): void {
  const o = kyHop ? danLaiKyHop(m) : m.o;
  const tt = m.trang_thai!;
  const oLich = LICH_CHINH_SACH.O_THEO_MAP[SIZE] ?? [];
  const pha: GiaiDoanId[] = [];
  let runMat = 1; let runHuong = 1;
  // Nền ẩn trước ô i = trạng thái SAU ô pha/tin gần nhất (tin đóng băng chuỗi).
  let truocH: -1 | 0 | 1 = 0; let truocDai = 0;
  let nenH: -1 | 0 | 1 | null = null; let nenDai = 0;
  for (let i = 0; i < o.length; i += 1) {
    const x: OThiTruong = o[i]!;
    const t = tt[i]!;
    if (x.kind === 'giai_doan') {
      const p = x.giai_doan;
      kq.dem[p] += 1;
      const laLich = oLich.includes(i + 1);
      const nh: Nhanh = laLich ? 'lich'
        : t.face_prior_bp === 10000 ? 'ep'
          : p === 'phuc_hoi' && truocH === -1 && t.run_huong === 1 && t.run_dai === 1 ? 'cat'
            : truocH !== 0 && t.run_huong === truocH && t.run_dai === truocDai + 1 ? 'song'
              : truocH !== 0 && t.run_huong !== truocH ? 'gay'
                : truocH === 0 ? 'ngang' : 'khac';
      kq.nhanh[nh].o += 1;
      // Nguồn ô ĐI NGANG — suy từ nền trước/sau (máy tick ghi run SAU ô).
      if (p === 'di_ngang') {
        if (laLich) kq.nguonNgang.ky_hop_giu += 1;
        else if (truocH !== 0 && t.run_huong === truocH && t.run_dai === truocDai + 1) kq.nguonNgang.nghi_trong_xu_huong += 1;
        else if (truocH !== 0 && t.run_huong === 0) kq.nguonNgang.gay_ve_ngang += 1;
        else if (truocH === 0 && t.run_huong === 0) kq.nguonNgang.nen_ngang += 1;
        else kq.nguonNgang.khac += 1;
      }
      // Nền SỐNG: cùng hướng, tuổi +1, và không phải ô kỳ họp.
      if (!laLich && truocH !== 0 && t.run_huong === truocH && t.run_dai === truocDai + 1) {
        kq.songTong += 1;
        if ((truocH === 1 && p === 'tang') || (truocH === -1 && p === 'giam')) kq.songThuan += 1;
      }
      // Hazard TĂNG + mở LÊN (thước D301 — cặp ô pha kề).
      if (truocH === 1) { kq.songTang += 1; if (t.run_huong !== 1) kq.gayTang += 1; }
      if (truocH === 0 && t.run_huong !== 0) { kq.mo += 1; if (t.run_huong === 1) kq.moLen += 1; }
      // Độ dài nền ẩn đã kết thúc.
      if (nenH === null) { nenH = t.run_huong; nenDai = 1; }
      else if (t.run_huong !== nenH) {
        kq.nen[tenNen(nenH)].tong += nenDai; kq.nen[tenNen(nenH)].so += 1;
        nenH = t.run_huong; nenDai = 1;
      } else nenDai += 1;
      // Chuỗi mặt + chuỗi hướng + ma trận.
      const truoc = pha[pha.length - 1];
      if (truoc !== undefined) {
        kq.chuyen[truoc][p] += 1;
        kq.capPha += 1;
        const hp = huong(truoc); const hq = huong(p);
        if (hp !== 0 && hq !== 0 && hp !== hq) kq.doiHuong += 1;
        if (truoc === p) runMat += 1;
        else { kq.chuoiTong += runMat; kq.chuoiSo += 1; runMat = 1; kq.doiMatTong += 1; kq.nhanh[nh].doi += 1; }
        if (hp === hq) runHuong += 1; else { kq.chuoiHuongTong += runHuong; kq.chuoiHuongSo += 1; runHuong = 1; }
      }
      pha.push(p);
    }
    truocH = t.run_huong; truocDai = t.run_dai;
  }
  kq.chuoiTong += runMat; kq.chuoiSo += 1;
  kq.chuoiHuongTong += runHuong; kq.chuoiHuongSo += 1;
  kq.soBan += 1;
  if (pha.includes('phuc_hoi')) kq.banCoPhucHoi += 1;
  if (pha.some((p, k) => p === 'giam' && pha[k + 1] === 'giam')) kq.banCoGiam2 += 1;
  if (coMotVong(pha)) kq.banMotVong += 1;
}

/** Ô kỳ họp GIỮ mà nền trước/sau là cùng một xu hướng đang sống ⇒ đọc bằng mặt xu hướng. */
function danLaiKyHop(m: HoldemMap): readonly OThiTruong[] {
  const oLich = LICH_CHINH_SACH.O_THEO_MAP[m.o.length] ?? [];
  const tt = m.trang_thai!;
  return m.o.map((x, i) => {
    if (x.kind !== 'giai_doan' || x.giai_doan !== 'di_ngang' || !oLich.includes(i + 1)) return x;
    const truoc = i > 0 ? tt[i - 1]! : { run_huong: 0 as const, run_dai: 0 };
    const sau = tt[i]!;
    if (truoc.run_huong === 0 || sau.run_huong !== truoc.run_huong || sau.run_dai !== truoc.run_dai + 1) return x;
    return { kind: 'giai_doan', giai_doan: truoc.run_huong === 1 ? 'tang' : 'giam' } as const;
  });
}

const HAT = (s: number): number => s * 7919 + 13;

function doBo(size: number, n: number, kyHop = false): KetQua {
  const kq = khoiTao();
  for (let s = 0; s < n; s += 1) doMotBan(sinhMap(HAT(s), size, TC), kq, kyHop);
  return kq;
}

// ─── IN ───────────────────────────────────────────────────────────────────────────────────
const pct = (a: number, b: number): string => `${((a * 100) / Math.max(1, b)).toFixed(1)}%`;
const so2 = (x: number): string => x.toFixed(2).replace('.', ',');
const phan = (a: number, b: number): string => so2(a / Math.max(1, b));

function tomTat(kq: KetQua): Record<string, string> {
  const tongPha = PHA.reduce((a, p) => a + kq.dem[p], 0);
  const soNgang = kq.dem.di_ngang;
  return {
    chuoi: phan(kq.chuoiTong, kq.chuoiSo),
    chuoiHuong: phan(kq.chuoiHuongTong, kq.chuoiHuongSo),
    doiMat: phan(kq.doiMatTong, kq.soBan),
    tang: pct(kq.dem.tang, tongPha), ngang: pct(kq.dem.di_ngang, tongPha), giam: pct(kq.dem.giam, tongPha),
    bd: pct(kq.dem.bien_dong, tongPha), ph: pct(kq.dem.phuc_hoi, tongPha),
    thuan: pct(kq.songThuan, kq.songTong),
    nenLen: phan(kq.nen.len.tong, kq.nen.len.so), nenXuong: phan(kq.nen.xuong.tong, kq.nen.xuong.so),
    nenNgang: phan(kq.nen.ngang.tong, kq.nen.ngang.so),
    hzTang: pct(kq.gayTang, kq.songTang), moLen: pct(kq.moLen, kq.mo),
    banPh: pct(kq.banCoPhucHoi, kq.soBan), banG2: pct(kq.banCoGiam2, kq.soBan), banVong: pct(kq.banMotVong, kq.soBan),
    daoChieu: pct(kq.doiHuong, kq.capPha),
    ngKyHop: pct(kq.nguonNgang.ky_hop_giu, soNgang), ngNghi: pct(kq.nguonNgang.nghi_trong_xu_huong, soNgang),
    ngGay: pct(kq.nguonNgang.gay_ve_ngang, soNgang), ngNen: pct(kq.nguonNgang.nen_ngang, soNgang),
    ngKhac: pct(kq.nguonNgang.khac, soNgang),
  };
}

function inMaTran(kq: KetQua): void {
  console.log(`   ${''.padEnd(11)}${PHA.map((t) => t.slice(0, 8).padStart(10)).join('')}`);
  for (const p of PHA) {
    const r = kq.chuyen[p];
    const tot = PHA.reduce((a, q) => a + r[q], 0) || 1;
    console.log(`   ${p.padEnd(11)}${PHA.map((q) => `${((r[q] * 100) / tot).toFixed(0)}%`.padStart(10)).join('')}`);
  }
}

const NHAN: Record<GiaiDoanId, string> = {
  tang: 'TĂNG', giam: 'GIẢM', di_ngang: 'ngang', bien_dong: 'b.động', phuc_hoi: 'PHỤC HỒI',
};
const MUI_TEN: Record<string, string> = { '1': '↑', '-1': '↓', '0': '·' };

function inBanMau(size: number, s: number): void {
  const m = sinhMap(HAT(s), size, TC);
  const oLich = LICH_CHINH_SACH.O_THEO_MAP[size] ?? [];
  const mat = m.o.map((x, i) => {
    const lich = oLich.includes(i + 1) ? '⚖' : '';
    if (x.kind === 'giai_doan') return `${lich}${NHAN[x.giai_doan]}`;
    return `${lich}[${x.su_kien}${x.la_tin_gia ? '✗' : ''}]`;
  });
  const nen = m.trang_thai!.map((t) => MUI_TEN[String(t.run_huong)]!).join('');
  console.log(`   hạt ${HAT(s)}: ${mat.map((x, i) => `${i + 1}.${x}`).join('  ')}`);
  console.log(`   ${''.padEnd(String(HAT(s)).length + 6)}nền ẩn: ${nen}   (↑ lên · ↓ xuống · · ngang)`);
}

console.log(`QUÉT CHU KỲ — ${N} map · bàn ${SIZE} · luật ${PHIEN_BAN} · bộ số máy tick ${LUAT.chuKyThucTe ? 'THỰC TẾ (v39+)' : 'GỐC'}\n`);

if (DON_LE) {
  /*
   * ĐỘ NHẠY — đổi đúng MỘT cần gạt mỗi dòng, mọi thứ khác giữ bộ đang chạy. Trả lời câu (a) của
   * đề: tham số nào quyết định quán tính mặt · lực hút về đi ngang · tần suất phục hồi.
   */
  const DONG: readonly [string, GhiDe][] = [
    ['(đang chạy)', {}],
    ['MAT_THUAN 7000→9000', { MAT_THUAN_BP: 9000 }],
    ['MAT_NGHI 1800→600', { MAT_NGHI_BP: 600 }],
    ['MAT_BIEN_DONG 1200→400', { MAT_BIEN_DONG_BP: 400 }],
    ['HAZARD_NEN 2000→1200', { HAZARD_NEN_BP: 1200 }],
    ['HAZARD_GIAM_NEN 2500→1500', { HAZARD_GIAM_NEN_BP: 1500 }],
    ['HAZARD_GIAM_TUOI 2000→800', { HAZARD_GIAM_TUOI_BP: 800 }],
    ['NGANG_NGHI 2400→5000', { NGANG_NGHI_BP: 5000 }],
    ['NGANG_BIEN_DONG 1800→600', { NGANG_BIEN_DONG_BP: 600 }],
    ['NGANG_MO_HUONG 5200→3000', { NGANG_MO_HUONG_BP: 3000 }],
    ['GAY_VE_NGANG 4300→2000', { GAY_VE_NGANG_BP: 2000 }],
    ['GAY_BIEN_DONG 2000→600', { GAY_BIEN_DONG_BP: 600 }],
    ['CAT_CHUOI_XAU 7500→9500', { CAT_CHUOI_XAU_BP: 9500 }],
  ];
  console.log(`${'cần gạt'.padEnd(28)}${'chuỗi mặt'.padStart(10)}${'chuỗi hướng'.padStart(12)}${'đổi mặt/bàn'.padStart(12)}${'ngang'.padStart(8)}${'phục hồi'.padStart(10)}${'bàn có PH'.padStart(10)}${'một vòng'.padStart(10)}`);
  for (const [ten, g] of DONG) {
    apDung(g);
    const t = tomTat(doBo(SIZE, N));
    console.log(`${ten.padEnd(28)}${t.chuoi!.padStart(10)}${t.chuoiHuong!.padStart(12)}${t.doiMat!.padStart(12)}${t.ngang!.padStart(8)}${t.ph!.padStart(10)}${t.banPh!.padStart(10)}${t.banVong!.padStart(10)}`);
  }
  apDung({});
} else {
  const chon = (co('bo') ?? BO.map((b) => b.ma).join(',')).split(',');
  for (const ma of chon) {
    const bo = BO.find((b) => b.ma === ma);
    if (!bo) throw new Error(`không có bộ "${ma}" — có: ${BO.map((b) => b.ma).join(', ')}`);
    apDung(bo.ghiDe);
    const kq = doBo(SIZE, N, bo.kyHopTheoXuHuong === true);
    const t = tomTat(kq);
    if (GON) {
      console.log(`${bo.ma.padEnd(4)} chuỗi mặt ${t.chuoi} · hướng ${t.chuoiHuong} · đổi mặt ${t.doiMat}/bàn · MỘT VÒNG ${t.banVong} · GIẢM GIẢM ${t.banG2} · PH ${t.ph} (bàn ${t.banPh}) · tăng ${t.tang} giảm ${t.giam} ngang ${t.ngang} bđ ${t.bd} · nền lên ${t.nenLen} xuống ${t.nenXuong} · hz TĂNG ${t.hzTang}${bo.kyHopTheoXuHuong ? ' · [kỳ họp theo xu hướng — ước lượng]' : ''}`);
      continue;
    }
    console.log(`══ BỘ ${bo.ma} — ${bo.ten}: ${bo.y}`);
    console.log(`   ghi đè: ${Object.keys(bo.ghiDe).length === 0 ? '(không)' : Object.entries(bo.ghiDe).map(([k, v]) => `${k} ${GOC[k]}→${v}`).join(' · ')}`);
    console.log(`   CHUỖI CÙNG MẶT ${t.chuoi} ô · cùng hướng ${t.chuoiHuong} ô · đổi mặt ${t.doiMat} lần/bàn · đảo tăng↔giảm ngay ô kế ${t.daoChieu}`);
    console.log(`   pha: tăng ${t.tang} · ngang ${t.ngang} · giảm ${t.giam} · biến động ${t.bd} · phục hồi ${t.ph}`);
    console.log(`   nền ẩn TB (ô pha): lên ${t.nenLen} · xuống ${t.nenXuong} · ngang ${t.nenNgang} · nền sống lật đúng mặt ${t.thuan}`);
    const tongO = NHANH.reduce((a, k) => a + kq.nhanh[k].o, 0);
    console.log(`   ô pha theo nhánh máy (tỷ lệ ô · số lần ĐỔI MẶT nó gây ra mỗi bàn):`);
    console.log(`     ${NHANH.filter((k) => kq.nhanh[k].o > 0).map((k) => `${TEN_NHANH[k]} ${pct(kq.nhanh[k].o, tongO)} · ${phan(kq.nhanh[k].doi, kq.soBan)}`).join(' | ')}`);
    console.log(`   ô ĐI NGANG từ đâu: kỳ họp giữ ${t.ngKyHop} · nghỉ giữa xu hướng ${t.ngNghi} · gãy về ngang ${t.ngGay} · nền ngang ${t.ngNen} · khác ${t.ngKhac}`);
    console.log(`   bàn có PHỤC HỒI ${t.banPh} · có GIẢM GIẢM ${t.banG2} · đọc ra MỘT VÒNG (lên≥2→xuống≥2→lên) ${t.banVong}`);
    console.log(`   thước D301: hazard chuỗi TĂNG/ô ${t.hzTang} (nguồn 18–30%) · mở LÊN từ ngang ${t.moLen} (58–72%)`);
    console.log('   ma trận chuyển P(kế | này):');
    inMaTran(kq);
    if (SO_MAU > 0) {
      console.log('   bàn mẫu (cùng hạt ở mọi bộ — so được từng ô):');
      for (let s = 0; s < SO_MAU; s += 1) inBanMau(SIZE, s);
    }
    console.log('');
  }
  apDung({});
}
