/**
 * NGỌN LỬA ĐÀ (lửa momentum) — v55 (D409). Đặc tả founder 23/09 (`cai-tien-du-dinh.md` §1.3):
 *   · pixel 16×16, 8–12 FPS, LUÔN flicker; nấc 0 TÀN (than, không số) · 1 · 2 · 3 BÙNG (lõi trắng);
 *   · palette tàn `#3a2a1a #5c4030` · lửa `#ff6b1a → #fff1a8` · đặc biệt `#4fc3f7 → #7b61ff → #e040fb`;
 *   · lên nấc: 0,35–0,5 s nảy quá 110% (chuyển động vật lý ⇒ cubic-bezier); bị dập: 0,4–0,6 s nghiêng như bị thổi,
 *     về than, vài pixel khói bay lên (vật ⇒ steps); tia lửa/khói theo nấc.
 * Con số nấc đi bằng font app (không chữ "x", không emoji — D47; D443 thôi `ChuPixel`: một font cho cả màn). Chỉ animate transform/opacity (§2.5 vfx).
 * Lưới vẽ bằng box-shadow như `PixelIcon` — mỗi ký tự một pixel — nhưng bảng màu RIÊNG (màu founder không có trong
 * PALETTE chung). Reduced motion: đứng yên đúng nấc, không flicker, không nảy.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import s from './LuaMomentum.module.css';

export type NacLua = 0 | 1 | 2 | 3;
export type LyDoDap = 'doi_bias' | 'doi_tay' | 'mua_duoi_muon';

const PAL_LUA: Readonly<Record<string, string>> = {
  t: '#3a2a1a', u: '#5c4030', a: '#ff6b1a', b: '#ff9a2e', c: '#ffd166', d: '#fff1a8', W: '#ffffff', k: '#8a7a70',
};
const PAL_DAC_BIET: Readonly<Record<string, string>> = {
  t: '#1c2a3a', u: '#2c4460', a: '#4fc3f7', b: '#6a8dfb', c: '#7b61ff', d: '#e040fb', W: '#ffffff', k: '#8a7a70',
};

/** Vẽ một lưỡi lửa dạng giọt: `cao` hàng, lệch đầu `lech` pixel, có lõi trắng hay không — ra lưới 16×16. */
function veLuoi(cao: number, rong: number, lech: number, loiTrang: boolean): string[] {
  const N = 16;
  const o: string[][] = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  const tam = 8;
  // Than ở hai hàng đáy — luôn có, kể cả nấc 0.
  for (let x = tam - 2; x <= tam + 1; x += 1) { o[N - 1]![x] = 'u'; o[N - 2]![x] = 't'; }
  o[N - 1]![tam - 3] = 't'; o[N - 1]![tam + 2] = 't';
  if (cao <= 0) return o.map((r) => r.join(''));
  const dinh = N - 3 - cao; // hàng đỉnh lưỡi
  for (let y = dinh; y <= N - 3; y += 1) {
    const f = (y - dinh) / Math.max(1, N - 3 - dinh);   // 0 đỉnh … 1 gốc
    const nua = Math.max(0, Math.round((rong / 2) * Math.sin(Math.PI * Math.min(1, 0.15 + f * 0.85))));
    const doiTam = Math.round(lech * (1 - f));           // đầu lưỡi lệch, gốc đứng yên
    for (let x = tam + doiTam - nua; x <= tam + doiTam + nua - (nua > 0 ? 1 : 0); x += 1) {
      if (x < 0 || x >= N) continue;
      const rìa = Math.abs(x - (tam + doiTam)) >= nua - 1 && nua > 1;
      let ch = f > 0.75 ? 'a' : f > 0.45 ? 'b' : f > 0.15 ? 'c' : 'd';
      if (rìa && f > 0.3) ch = ch === 'a' ? 'a' : 'b';
      o[y]![x] = ch;
    }
  }
  if (loiTrang) {
    for (let y = N - 5; y <= N - 3; y += 1) for (let x = tam - 1; x <= tam; x += 1) o[y]![x] = 'W';
  }
  return o.map((r) => r.join(''));
}

/** Ba khung hình mỗi nấc (flicker) — lệch đầu lưỡi −1 · 0 · +1 và cao ±1. */
const KHUNG: Readonly<Record<NacLua, readonly (readonly string[])[]>> = {
  0: [veLuoi(0, 0, 0, false), veLuoi(0, 0, 0, false), veLuoi(0, 0, 0, false)],
  1: [veLuoi(5, 4, -1, false), veLuoi(6, 4, 0, false), veLuoi(5, 4, 1, false)],
  2: [veLuoi(8, 6, -1, false), veLuoi(9, 6, 0, false), veLuoi(8, 6, 1, false)],
  3: [veLuoi(11, 8, -1, true), veLuoi(12, 8, 0, true), veLuoi(11, 8, 1, true)],
};
/** Tia lửa: vài pixel rời phía trên lưỡi, nhiều dần theo nấc. */
const TIA: Readonly<Record<NacLua, readonly (readonly [number, number])[]>> = {
  0: [], 1: [[6, 6]], 2: [[5, 4], [11, 5]], 3: [[4, 2], [12, 3], [7, 1]],
};

export function luoiToShadow(luoi: readonly string[], px: number, pal: Readonly<Record<string, string>>): string {
  const ra: string[] = [];
  luoi.forEach((hang, y) => {
    for (let x = 0; x < hang.length; x += 1) {
      const c = pal[hang[x]!];
      if (c) ra.push(`${x * px}px ${y * px}px 0 0 ${c}`);
    }
  });
  return ra.join(',');
}

export interface LuaMomentumProps {
  nac: NacLua;
  dacBiet?: boolean;
  /** Lý do vừa bị dập (chỉ để test/dữ liệu đọc — hoạt ảnh dập chạy khi nấc GIẢM so với lần render trước). */
  dap?: LyDoDap | null;
  /** Cạnh ô vẽ (px) — bội của 16. */
  co?: 16 | 32 | 48;
  nhan?: string;
  className?: string;
}

export function LuaMomentum({ nac, dacBiet = false, dap = null, co = 16, nhan, className }: LuaMomentumProps) {
  const itMotion = useReducedMotion();
  const truoc = useRef<NacLua>(nac);
  const [nhip, setNhip] = useState<{ kieu: 'nay' | 'dap' | null; lan: number }>({ kieu: null, lan: 0 });
  useEffect(() => {
    if (nac === truoc.current) return;
    const kieu = nac > truoc.current ? 'nay' : 'dap';
    truoc.current = nac;
    setNhip((c) => ({ kieu, lan: c.lan + 1 }));
  }, [nac]);
  const px = Math.max(1, Math.round(co / 16));
  const pal = dacBiet ? PAL_DAC_BIET : PAL_LUA;
  const khung = KHUNG[nac];
  const tia = TIA[nac];
  const kieu = itMotion ? null : nhip.kieu;
  return (
    <span
      key={`lua-${nhip.lan}`}
      className={[
        s.lua, s[`nac${nac}`], dacBiet ? s.dacBiet : '', itMotion ? s.tinh : '',
        kieu === 'nay' ? s.nay : '', kieu === 'dap' ? s.dap : '', className ?? '',
      ].filter(Boolean).join(' ')}
      style={{ '--lua-px': `${px}px`, width: `${co}px`, height: `${co}px` } as CSSProperties}
      role="img"
      aria-label={nhan ?? (nac === 0 ? 'Ngọn lửa đà: tàn' : `Ngọn lửa đà: nấc ${nac}`)}
      data-tap="lua"
      data-nac={nac}
      data-dac-biet={dacBiet ? '1' : '0'}
      data-dap={dap ?? ''}
      {...(kieu ? { 'data-nhip': kieu } : {})}
    >
      {khung.map((g, i) => (
        <i key={i} className={`${s.khung} ${s[`k${i}`] ?? ''}`} style={{ boxShadow: luoiToShadow(g, px, pal) }} aria-hidden />
      ))}
      {tia.length > 0 && (
        <i
          className={s.tia}
          style={{ boxShadow: tia.map(([x, y]) => `${x * px}px ${y * px}px 0 0 ${pal.d}`).join(',') }}
          aria-hidden
        />
      )}
      {kieu === 'dap' && (
        <i
          className={s.khoi}
          style={{ boxShadow: [[7, 8], [9, 6], [6, 4]].map(([x, y]) => `${x! * px}px ${y! * px}px 0 0 ${pal.k}`).join(',') }}
          aria-hidden
        />
      )}
      {/* D443 — số nấc đi bằng font app (Handjet), viền tối cứng để đọc được trên hình lửa. */}
      {nac > 0 && <span className={s.so} aria-hidden>{nac}</span>}
    </span>
  );
}
