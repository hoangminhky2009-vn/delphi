/**
 * ĐO GB-GIỜ MỖI MÀN MINIGAME — thí nghiệm sạch cho trần "trận/ngày" (`docs/gioi-han-ha-tang.md` §④, ước tính D464
 * ~50–75 trận/ngày chưa đo).
 *
 * ─── VÌ SAO CẦN PROJECT VERCEL RIÊNG ────────────────────────────────────────
 * Vercel Hobby không cho đọc mức dùng qua API (Observability · billing đều 404 "Plan not found"); con số GB-giờ chỉ
 * có trên trang Usage, gộp THEO PROJECT. Nên thí nghiệm chạy trên một project không làm gì khác (`delphi-api-mg`,
 * sin1, DB thử): GB-giờ của project ấy ÷ số màn = GB-giờ mỗi màn, đọc thẳng, không suy.
 *
 * ─── CHƠI GÌ ────────────────────────────────────────────────────────────────
 * Mỗi màn: `POST /matches` → `GET /shop` → `POST /rounds` vòng 1 (mua lõi) → `POST /minigame` → đọc DÒNG nhịp NDJSON
 * tới `het` (nối lại khi gặp `noi_lai`, như client — `web/src/api/minigame.ts` `docDongNhip`). `--song-song K` = K người
 * chơi cùng lúc, mỗi người chơi màn nối màn (mặc định 1 = kịch bản thưa, đắt nhất: không có gì để fluid compute dồn).
 *
 * Cùng hai chốt chặn prod của `do_tai_rounds.ts` (`kiemDich`): `POST /rounds` ghi `events` append-only (A3.3).
 *   npx tsx --env-file=../../../.env.thu scripts/do_gb_gio_minigame.ts --url https://api-staging.example.vercel.app --man 30
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { createTestUser, type TestUser } from '../tests/helpers/fixtures.js';
import { kiemDich } from './do_tai_rounds.js';

interface KetQuaMan { ok: boolean; buoc: string; giayDong: number; soLanMo: number; soGoi: number }

// B1 (D613): đích là origin Vercel ⇒ phải mang proxy secret như Worker (PROXY_SHARED_SECRET của project thử trong .env.thu).
const DAU_PROXY: Record<string, string> = process.env.PROXY_SHARED_SECRET
  ? { 'x-delphi-proxy-secret': process.env.PROXY_SHARED_SECRET } : {};

async function motMan(base: string, u: TestUser): Promise<KetQuaMan> {
  const api = `${base}/api/v1/holdem/matches`;
  let soGoi = 0;
  const goi = async (p: string, init: RequestInit = {}) => {
    soGoi += 1;
    const r = await fetch(p, { ...init, headers: { 'content-type': 'application/json', cookie: u.cookie, ...DAU_PROXY } });
    return { r, j: await r.json().catch(() => null) as any };
  };
  // Vòng 1 chỉ có lõi để mua khi shop mời — thử vài trận như bài luồng D574.
  for (let lan = 0; lan < 6; lan++) {
    const t = await goi(api, { method: 'POST', body: '{}' });
    if (t.r.status !== 201) return { ok: false, buoc: `matches ${t.r.status} ${t.j?.error ?? ''}`, giayDong: 0, soLanMo: 0, soGoi };
    const id = t.j.match_id as string;
    const sh = await goi(`${api}/${id}/shop?lan=0`);
    const loi = sh.j?.shop?.chien_thuat?.[0];
    if (!loi) continue;
    const nop = await goi(`${api}/${id}/rounds`, { method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: [loi], hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }) });
    if (nop.r.status !== 200) continue;
    const mo = await goi(`${api}/${id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
    if (mo.r.status !== 200) continue;
    let tu = 0, giay = 0, soLanMo = 0;
    for (let noi = 0; noi < 6; noi++) {
      soGoi += 1; soLanMo += 1;
      const t0 = performance.now();
      const r = await fetch(`${api}/${id}/minigame/1/nhip?tu=${tu}`, { headers: { cookie: u.cookie, ...DAU_PROXY } });
      if (!r.ok || !r.body) return { ok: false, buoc: `nhip ${r.status}`, giayDong: giay, soLanMo, soGoi };
      const rd = r.body.getReader(), dec = new TextDecoder();
      let du = '', ket: 'het' | 'noi_lai' | null = null;
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        du += dec.decode(value, { stream: true });
        let i: number;
        while ((i = du.indexOf('\n')) >= 0) {
          const d = JSON.parse(du.slice(0, i)); du = du.slice(i + 1);
          if (d.loai === 'het') ket = 'het';
          if (d.loai === 'noi_lai') { ket = 'noi_lai'; tu = d.tu; }
        }
      }
      giay += (performance.now() - t0) / 1000;
      if (ket !== 'noi_lai') return { ok: ket === 'het', buoc: ket ?? 'dong_dut', giayDong: giay, soLanMo, soGoi };
    }
    return { ok: false, buoc: 'noi_qua_nhieu', giayDong: giay, soLanMo, soGoi };
  }
  return { ok: false, buoc: 'khong_mo_duoc_man', giayDong: 0, soLanMo: 0, soGoi };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const lay = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const base = (lay('--url') ?? 'https://api-staging.example.vercel.app').replace(/\/$/, '');
  const soMan = Number(lay('--man') ?? 3);
  const k = Math.max(1, Number(lay('--song-song') ?? 1));
  const loi = kiemDich(base, process.env.DATABASE_URL);
  if (loi.length) { for (const l of loi) console.error(`✖ ${l}`); process.exit(1); }
  const pool = createPool(process.env.DATABASE_URL!, { max: 3 });
  const tienTo = `m${Date.now().toString(36).slice(-6)}`;
  const nguoi = await Promise.all(Array.from({ length: k }, () => createTestUser(pool, { tienTo })));
  await pool.end();
  const batDau = new Date();
  console.log(`→ ${soMan} màn · ${k} người song song · đích ${base} · bắt đầu ${batDau.toISOString()}`);
  const kq: KetQuaMan[] = [];
  let con = soMan;
  await Promise.all(nguoi.map(async (u) => {
    while (con > 0) {
      con -= 1;
      const r = await motMan(base, u);
      kq.push(r);
      console.log(`  màn ${kq.length}: ${r.ok ? 'ok' : 'HỎNG'} ${r.buoc} · dòng ${r.giayDong.toFixed(1)} s · mở ${r.soLanMo} lần · ${r.soGoi} lượt gọi`);
    }
  }));
  const ok = kq.filter((x) => x.ok);
  const tong = (f: (x: KetQuaMan) => number) => kq.reduce((a, x) => a + f(x), 0);
  console.log(`\nXONG ${new Date().toISOString()} · ${ok.length}/${kq.length} màn trọn · tổng giây dòng ${tong((x) => x.giayDong).toFixed(0)} s · ${tong((x) => x.soGoi)} lượt gọi`);
  console.log('⇒ đọc GB-giờ (Fluid Provisioned Memory) + Active CPU + Invocations của project này trên trang Usage, chia cho số màn trọn.');
}

const laMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (laMain) await main();
