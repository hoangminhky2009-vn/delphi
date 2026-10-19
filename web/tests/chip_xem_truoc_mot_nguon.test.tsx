/**
 * GATE — XEM TRƯỚC CHIP = ĐÚNG ĐƯỜNG SERVER ÁP (D446).
 *
 * Founder 28/09: *"PHẦN CHIP thì lỗi nghiêm trọng … Kiểm tra kỹ những thao tác đặt cược để rà lỗi"*. Rà trên engine thật
 * (API giả, trận v55 × ba vai, lệnh ngẫu nhiên, KHỚP NGAY rồi đọc lại): bản xem trước ở màn shop lệch server ở BỐN chỗ —
 * phí tới 31 chip, vị thế 1–3 chip ở hơn nửa số lần khớp, mốc 10 % của LỆNH MỊN bị báo "mốc không hợp lệ", trần số mã của
 * TẦM RỘNG bị báo "đầy tài sản" trong khi server khớp. Cả bốn cùng MỘT gốc: màn tự chép tay từng cờ của đường áp lệnh qua
 * DTO, và v55 thêm bốn khoá (lửa · Mua Đuổi muộn · mốc thêm · trần số mã theo trait) mà không ai chép.
 *
 * Bản vá không chép thêm cờ nào: server phát NGUYÊN bộ tham số nó áp (`tuyChonLenhGhe` → `ban.tuy_chon_lenh`), màn đưa
 * nguyên bộ ấy vào CHÍNH `giaiLenhMoc` + `apLenhGiaoDich`. Bài này canh cả LỚP, không canh bốn ca:
 *   §I   ĐỐI CHIẾU trên engine thật — vai × lửa × trait × lõi × vòng × chuỗi lệnh ngẫu nhiên (cả lệnh hỏng): xem trước bằng
 *        bộ tham số ĐÃ QUA JSON (đúng như nó đi qua mạng) phải ra ĐÚNG tiền mặt · vị thế · sổ khống · phí · mã lỗi mà
 *        `apLenhMocNav` ra. Mỗi khoá phải được CHẠM — quét không chạm thì bài tự đỏ (tiền lệ D103), vì một cơ chế không
 *        bao giờ bật trong bài thì "khớp" của nó là khớp rỗng.
 *   §II  MỘT NGUỒN ở server — mọi lời gọi lõi lệnh ngoài `nav.ts` chỉ nhận bộ từ `tuyChonLenhGhe`: ai thêm cờ tại chỗ gọi
 *        (đúng cách v55 đã trôi) là bài đỏ trước khi màn kịp lệch.
 *   §III DÂY NỐI — DTO → màn trận → shop: bộ tham số tới được bản xem trước và dòng "sẽ bị từ chối".
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HOLDEM_BALANCE_VERSION, HOLDEM_MATCH, NAV_V10, TAI_SAN as TAI_SAN_CFG } from '@config/holdem';
import { luatCua } from '@config/holdem_balance';
import type { TraitId } from '@config/trait';
import {
  apLenhMocNav, taoTran, tuyChonLenhGhe, type Ghe, type TrangThaiTran, type TuyChonLenhGhe,
} from '@server/holdem/engine';
import type { LenhMoc } from '@server/holdem/nav';
import type { VaiId } from '@server/holdem/vai';

vi.mock('@/lib/telemetry', () => ({ ghiDo: () => {} }));

import { ShopManHinh } from '../src/components/holdem/ShopManHinh';
import { lyDoTuChoiTheoTuyChon, tuyChonLenhChoShop, xemTruocTheoTuyChon } from '../src/lib/xemTruocLenh';

const MA = TAI_SAN_CFG.map((t) => t.id);
const NHOM = new Map(TAI_SAN_CFG.map((t) => [t.id as string, t.nhom as string]));
const VAI: readonly VaiId[] = ['ca_nhan', 'ca_map', 'doi_lai', 'to_chuc'];
const LOI_CT = ['mua_duoi', 'chia_lenh', 'ban_khong', 'da_dang_hoa', 'khop_nhanh', 'don_bay'] as const;
/** Trait CHẠM lệnh chip (mốc thêm · trần mã · phí cố định · trần bán · mù lửa). Trait khác không vào bộ tham số lệnh. */
const TRAIT_LENH: readonly TraitId[] = ['lenh_min', 'tam_rong', 'so_mong', 'gong_cum', 'mot_gio', 'mu_lua'];
/** Mốc: đủ mốc thô, mốc LỆNH MỊN, và hai mốc hỏng (lệch bước · quá 100 %). */
const MOC = [1000, 2500, 2500, 5000, 5000, 7500, 10000, 10000, 3000, 12500];
const CHIEU = ['mua', 'mua', 'mua', 'mua', 'ban', 'ban', 'ban', 'khong', 'dong_khong'] as const;

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; };
}
/** Đúng đường bộ tham số đi thật: server → JSON → client. Khoá `undefined` rơi, mảng thành mảng thường. */
const quaMang = (tc: TuyChonLenhGhe): TuyChonLenhGhe => JSON.parse(JSON.stringify(tc)) as TuyChonLenhGhe;

function doiGhe(st: TrangThaiTran, them: Partial<Ghe>): TrangThaiTran {
  const ghe = [...st.ghe];
  ghe[0] = { ...ghe[0]!, ...them };
  return { ...st, ghe };
}

describe('§I — xem trước bằng bộ tham số server phát = đúng thứ engine áp', () => {
  it(`⭐ ${HOLDEM_BALANCE_VERSION}: 32 trận × 18 bước × bốn vai × lửa 0–3 × trait lệnh × lõi × vòng × chuỗi lệnh ngẫu nhiên — tiền · vị thế · khống · phí · lỗi khớp tuyệt đối`, () => {
    const luat = luatCua(HOLDEM_BALANCE_VERSION);
    const cham: Record<string, number> = {};
    const tang = (k: string): void => { cham[k] = (cham[k] ?? 0) + 1; };

    for (let tran = 0; tran < 32; tran += 1) {
      const r = lcg(446_000 + tran);
      const chon = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
      const vai = VAI[tran % VAI.length]!;
      let st = taoTran(446_000 + tran, [
        { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', vai, danh_muc: { tai_san: [], chien_thuat: [] } },
        { id: 'b1', loai: 'bot', bac_rank: 'Đồng', vai: VAI[(tran + 1) % VAI.length]!, danh_muc: { tai_san: [], chien_thuat: [] } },
      ], luat, 16);
      // Chốt tự phát hiện: mặc định thôi bật NAV thì cả bài mất nghĩa — đỏ TO thay vì xanh rỗng.
      expect(st.nav, 'mặc định không còn NAV — bài đối chiếu chip không còn đo gì').toBe(true);

      for (let buoc = 0; buoc < 18; buoc += 1) {
        if (buoc % 3 === 0) {
          // Bối cảnh ghế đổi theo cụm bước: vòng (Mua Đuổi muộn đọc nhịp chuỗi của ô đã lật) · lửa · trait · lõi.
          const lop = st.ghe[0]!;
          st = doiGhe({ ...st, vong: 1 + Math.floor(r() * 14), phi_giao_dich_vong: 0 }, {
            // Một phần tư bối cảnh là ghế CẠN tiền mặt (sau mấy vòng lỗ) — chỗ phí cố định SỔ MỎNG nuốt trọn lệnh nhỏ.
            ...(r() < 0.25 ? { von: 150 + Math.floor(r() * 600) } : {}),
            lua: { nac: chon([0, 1, 2, 3] as const), chuoi: 0, bias: null },
            trait: TRAIT_LENH.filter(() => r() < 0.3),
            danh_muc: { ...lop.danh_muc, chien_thuat: LOI_CT.filter(() => r() < 0.35) as never },
            doi_tay_vong: { ban: 0, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 },
            // v56 (D447) — sổ đổi tay theo mã sống một vòng: cụm bước mới = vòng mới.
            doi_ma_vong: {},
          });
        }
        const g = st.ghe[0]!;
        const lenh: LenhMoc[] = [];
        const soLenh = 1 + Math.floor(r() * 3);
        for (let k = 0; k < soLenh; k += 1) {
          const ma = r() < 0.03 ? 'ma_la' : chon(MA);
          if (lenh.some((l) => l.ma === ma)) continue;
          lenh.push({ ma, chieu: chon(CHIEU), moc_bp: chon(MOC) });
        }

        const tc = quaMang(tuyChonLenhGhe(st, g));
        if (tc.heSoTruotBp !== undefined) tang('bối cảnh: lửa giảm trượt');
        if (tc.heSoTruotMuaRuiRoBp !== undefined) tang('bối cảnh: Mua Đuổi muộn');
        if (tc.mocThem !== undefined) tang('bối cảnh: mốc thêm LỆNH MỊN');
        if (tc.tranBanVong !== undefined) tang('bối cảnh: trần bán GÔNG CÙM');
        if (tc.phiCoDinhLenh !== undefined) tang('bối cảnh: phí cố định SỔ MỎNG');
        if (tc.mandate !== undefined) tang('bối cảnh: mandate tổ chức');
        if (tc.coBanKhong) tang('bối cảnh: mở khống');
        if (tc.coChiaLenh) tang('bối cảnh: Chia Lệnh');
        if (tc.phiLenhConBp !== undefined) tang('bối cảnh: Khớp Nhanh');
        if (tc.maxTaiSan > HOLDEM_MATCH.MAX_TAI_SAN) tang('bối cảnh: trần mã nới');
        if (tc.maxTaiSan < HOLDEM_MATCH.MAX_TAI_SAN) tang('bối cảnh: trần mã kẹp');
        if (tc.tacDongGia !== 1) tang('bối cảnh: hệ số vai');
        if (Object.values(tc.daDoiMa ?? {}).some((x) => x > 0)) tang('bối cảnh: phí cộng dồn đã có đổi tay (v56)');

        const nhap = { tienMat: g.von, viThe: g.vi_the, viKhong: g.vi_the_khong ?? {} };
        const xt = xemTruocTheoTuyChon(nhap, lenh, tc);
        const ld = lyDoTuChoiTheoTuyChon(nhap, lenh, tc);
        const that = apLenhMocNav(st, 'ban', lenh);
        const ngu = `trận ${tran} bước ${buoc} vai ${vai} vòng ${st.vong} · ${JSON.stringify(lenh)} · tc ${JSON.stringify(tc)}`;

        if (!that.ok) {
          tang('BÁC');
          tang(`bác: ${that.loi}`);
          expect(ld, `server bác mà màn không báo đúng lý do — ${ngu}`).toBe(that.loi);
          expect(xt, ngu).toBeNull();
          continue;
        }
        expect(ld, `server khớp mà màn báo lỗi — ${ngu}`).toBeNull();
        const g2 = that.st.ghe[0]!;
        if (xt === null) {
          tang('chuỗi rỗng');
          expect(g2.von, ngu).toBe(g.von);
          continue;
        }
        tang('KHỚP');
        if (lenh.some((l) => l.moc_bp === 1000)) tang('khớp: mốc 10 %');
        if (xt.buoc.some((b) => b.khong)) tang('khớp: lệnh khống');
        if (xt.phiCoDinh > 0) tang('khớp: có phí cố định');
        if (tc.heSoTruotMuaRuiRoBp !== undefined
          && xt.buoc.some((b) => b.tien > 0 && !b.khong && NHOM.get(b.ma) === 'rui_ro')) tang('khớp: mua rủi ro lúc muộn');
        if (Object.keys(xt.viTheSau).length > HOLDEM_MATCH.MAX_TAI_SAN) tang('khớp: giữ quá trần mã gốc');

        expect(xt.tienMatSau, `TIỀN MẶT lệch — ${ngu}`).toBe(g2.von);
        expect(xt.viTheSau, `VỊ THẾ lệch — ${ngu}`).toEqual(g2.vi_the);
        expect(xt.viKhongSau, `SỔ KHỐNG lệch — ${ngu}`).toEqual(g2.vi_the_khong ?? {});
        expect(xt.phi, `PHÍ lệch — ${ngu}`).toBe((that.st.phi_giao_dich_vong ?? 0) - (st.phi_giao_dich_vong ?? 0));
        st = that.st;
      }
    }

    // Độ phủ: mọi khoá của bộ tham số phải được bật ít nhất một lần, và phải có đủ cả khớp lẫn bác.
    // D525 — khoá v57+ bỏ lửa riêng của Mua Đuổi (`luaMuaDuoi` tắt, D456): "Mua Đuổi muộn" không tồn tại ⇒ chỉ đòi độ phủ khi cờ bật.
    const coMuaDuoiMuon = luat.luaMuaDuoi === true;
    // D530 — v60 `loiChiTrongMan`: lá Bán Khống thôi mở sổ khống (bán khống chỉ còn trong màn) ⇒ bốn đầu dò khống KHÔNG được chạm — và phải đúng 0.
    const coKhong = luat.loiChiTrongMan !== true;
    if (!coKhong) expect(cham['bối cảnh: mở khống'] ?? 0, 'v60: không ghế nào được mở khống ở shop').toBe(0);
    for (const k of [
      'bối cảnh: lửa giảm trượt', ...(coMuaDuoiMuon ? ['bối cảnh: Mua Đuổi muộn'] : []), 'bối cảnh: mốc thêm LỆNH MỊN', 'bối cảnh: trần bán GÔNG CÙM',
      'bối cảnh: phí cố định SỔ MỎNG', 'bối cảnh: mandate tổ chức', ...(coKhong ? ['bối cảnh: mở khống'] : []), 'bối cảnh: Chia Lệnh',
      'bối cảnh: Khớp Nhanh', 'bối cảnh: trần mã nới', 'bối cảnh: trần mã kẹp', 'bối cảnh: hệ số vai',
      'bối cảnh: phí cộng dồn đã có đổi tay (v56)',
      'khớp: mốc 10 %', ...(coKhong ? ['khớp: lệnh khống'] : []), 'khớp: có phí cố định', ...(coMuaDuoiMuon ? ['khớp: mua rủi ro lúc muộn'] : []), 'khớp: giữ quá trần mã gốc',
      'bác: gong_cum', 'bác: so_mong', 'bác: day_tai_san', 'bác: moc_khong_hop_le', ...(coKhong ? ['bác: khong_cam_san'] : []),
      'bác: ma_khong_ton_tai', 'bác: can_la_ban_khong', 'bác: mandate_ma', ...(coKhong ? ['bác: mandate_khong'] : []),
    ]) {
      expect(cham[k] ?? 0, `quét không chạm "${k}" — khớp ở khoá này là khớp rỗng. Độ phủ: ${JSON.stringify(cham)}`).toBeGreaterThan(0);
    }
    expect(cham['KHỚP'] ?? 0, JSON.stringify(cham)).toBeGreaterThanOrEqual(100);
    expect(cham['BÁC'] ?? 0, JSON.stringify(cham)).toBeGreaterThanOrEqual(30);
  });
});

/** Bóc chú thích trước khi quét mã (tiền lệ D87): docstring giải thích lệnh cấm có nhắc tên hàm. */
function boChuThich(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
function tepTs(goc: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(goc)) {
    const p = join(goc, ten);
    if (statSync(p).isDirectory()) ra.push(...tepTs(p));
    else if (p.endsWith('.ts')) ra.push(p);
  }
  return ra;
}

describe('§II — MỘT nguồn tham số lệnh ở server', () => {
  const GOC = resolve(process.cwd(), '../server');

  it('⭐ mọi lời gọi `giaiLenhMoc(` · `apLenhGiaoDich(` ngoài `nav.ts` nhận bộ từ `tuyChonLenhGhe` — không object dựng tại chỗ', () => {
    let soGoi = 0;
    for (const p of tepTs(GOC)) {
      if (p.replace(/\\/g, '/').endsWith('/holdem/nav.ts')) continue;
      const src = boChuThich(readFileSync(p, 'utf8'));
      for (const m of src.matchAll(/\b(giaiLenhMoc|apLenhGiaoDich)\(([^;]*?)\);/g)) {
        soGoi += 1;
        const doiSo = m[2]!;
        expect(doiSo, `${p}: ${m[0]} — dựng tham số tại chỗ gọi là mở lại đường trôi của v55`).not.toContain('{');
        expect(doiSo, `${p}: ${m[0]}`).toMatch(/\btc\b|tuyChonLenhGhe\(/);
      }
    }
    // Hai lời gọi của đường thật (`apLenhMocNav` · `apLenhVongNav`) — bằng 0 nghĩa là regex hỏng, bài rỗng.
    expect(soGoi).toBeGreaterThanOrEqual(2);
  });

  it('`tc` của `apLenhMocNav` chính là `tuyChonLenhGhe(st, g)`', () => {
    const src = boChuThich(readFileSync(join(GOC, 'holdem/engine.ts'), 'utf8'));
    const than = /export function apLenhMocNav\([\s\S]*?\n}\r?\n/.exec(src)?.[0] ?? '';
    expect(than, 'không tìm thấy thân apLenhMocNav').not.toBe('');
    expect(than).toMatch(/const tc = tuyChonLenhGhe\(st, g\);/);
  });

  it('DTO ghế phát đúng bộ ấy (`tuy_chon_lenh: tuyChonLenhGhe(st, nguoi)`)', () => {
    const api = boChuThich(readFileSync(join(GOC, 'holdem_api.ts'), 'utf8'));
    expect(api).toMatch(/tuy_chon_lenh:\s*tuyChonLenhGhe\(st, nguoi\)/);
  });
});

/* ─── §III — dây nối ở màn ───────────────────────────────────────────────────────────────────────────────────────── */
const TAI_SAN = [
  { id: 'btc', ten: 'Crypto', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
  { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
  { id: 'usd', ten: 'USD', mau: ['#22c55e', 'rgba(34,197,94,.22)'] as const },
];
type Nav = NonNullable<Parameters<typeof ShopManHinh>[0]['nav']>;
function dung(nav: Partial<Nav>) {
  return render(
    <ShopManHinh
      vong={5} loaiVongNay="tai_san" vongMoTiepTheo={{ tai_san: null, chien_thuat: null }}
      taiSan={TAI_SAN} chienThuat={[]} chonTS={[]} chonCT={null}
      onChonTS={() => {}} onChonCT={() => {}}
      danhMuc={[]} sucChuaTaiSan={4} sucChuaChienThuat={3} art={{}}
      ganVao={null} onGan={() => {}} phamViThe={() => 'danh_muc'}
      doiGan={{}} onDoiGan={() => {}}
      chiPhiRoll={1} luotConLai={1} onRoll={() => {}} onDong={() => {}} onChotVong={() => {}}
      tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
      giaiDoanNhan={[]} suKienNhan={[]} moTaChienThuat={() => undefined}
      nav={{
        tienMat: 10000, viThe: {}, viKhong: {}, buocMocBp: NAV_V10.BUOC_MOC_THO_BP,
        lenh: [], onThem: () => {}, onXoa: () => {}, startVon: 10000, lenhTruoc: [],
        ...nav,
      }}
    />,
  );
}
/** Bộ tham số của một ghế trơn ở luật đang chạy — đúng thứ server phát cho ghế không lửa, không trait, không lõi. */
function tcTron(): TuyChonLenhGhe {
  const st = taoTran(4460, [{ id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }],
    luatCua(HOLDEM_BALANCE_VERSION), 16);
  return quaMang(tuyChonLenhGhe(st, st.ghe[0]!));
}
const moSauLenh = (): void => { fireEvent.click(document.querySelector('[data-tap="shop-xemtruoc"]')!); };
function viTheSauTrenMan(ten: string): number {
  const hang = [...document.querySelectorAll('[data-sau-lenh-bang] li')]
    .find((li) => li.firstElementChild?.textContent === ten);
  expect(hang, `bảng SAU LỆNH không có dòng ${ten}`).toBeDefined();
  return Number((hang!.lastElementChild?.textContent ?? '').replace(/\D/g, ''));
}

describe('§III — dây nối DTO → màn trận → shop', () => {
  it('⭐ lửa nấc 3 (trượt giảm): vị thế SAU LỆNH trên màn = số lõi tính với bộ server phát — và khác số khi thiếu khoá lửa', () => {
    const goc = tcTron();
    const lua: TuyChonLenhGhe = { ...goc, heSoTruotBp: 7000 };
    const lenh: LenhMoc[] = [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }];
    dung({ tuyChonLenh: lua, lenh });
    moSauLenh();
    const nhap = { tienMat: 10000, viThe: {}, viKhong: {} };
    const dungSo = xemTruocTheoTuyChon(nhap, lenh, lua)!.viTheSau.btc!;
    const thieuLua = xemTruocTheoTuyChon(nhap, lenh, goc)!.viTheSau.btc!;
    expect(dungSo, 'khoá lửa không đổi số ⇒ bài không đo gì').not.toBe(thieuLua);
    expect(viTheSauTrenMan('CRYPTO'), 'màn không dùng bộ tham số server phát').toBe(dungSo);
  });

  it('⭐ LỆNH MỊN: mốc 10 % khớp được khi bộ server có `mocThem` — màn không báo "mốc không hợp lệ"', () => {
    const lenh: LenhMoc[] = [{ ma: 'btc', chieu: 'mua', moc_bp: 1000 }];
    dung({ tuyChonLenh: { ...tcTron(), mocThem: [1000] }, lenh });
    expect(screen.queryByTestId('chuoi-loi')).toBeNull();
    moSauLenh();
    expect(viTheSauTrenMan('CRYPTO')).toBeGreaterThan(0);
  });

  it('không có mốc thêm mà xếp mốc 10 % ⇒ dòng đỏ NÓI TRƯỚC (bộ server là biết chắc)', () => {
    dung({ tuyChonLenh: tcTron(), lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 1000 }] });
    expect(screen.getByTestId('chuoi-loi').getAttribute('data-loi')).toBe('moc_khong_hop_le');
  });

  it('⭐ trần số mã theo bộ server: vượt ⇒ dòng đỏ `day_tai_san`; vòng đang chọn lá lõi (`laVuaChon`) ⇒ chưa chắc, không báo', () => {
    const tc: TuyChonLenhGhe = { ...tcTron(), maxTaiSan: 2 };
    const nav = {
      tuyChonLenh: tc, tienMat: 5000, viThe: { btc: 2000, vang: 2000 },
      lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 5000 }] as LenhMoc[],
    };
    const { unmount } = dung(nav);
    expect(screen.getByTestId('chuoi-loi').getAttribute('data-loi')).toBe('day_tai_san');
    unmount();
    dung({ ...nav, laVuaChon: true });
    expect(screen.queryByTestId('chuoi-loi'), 'lá lõi đang chọn có thể nới trần mã — báo chắc là báo sai').toBeNull();
  });

  it('⭐ lá lõi đang chọn cộng đúng hai cờ nó mở; không chọn gì thì bộ server đi nguyên; server chưa phát ⇒ rỗng', () => {
    const tc = tcTron();
    expect(tc.coBanKhong, 'ghế trơn đã có cờ khống — ca dưới không đo gì').toBe(false);
    expect(tuyChonLenhChoShop(undefined, null)).toEqual({});
    expect(tuyChonLenhChoShop(tc, null)).toEqual({ tuyChonLenh: tc, laVuaChon: false });
    const khong = tuyChonLenhChoShop(tc, 'ban_khong');
    expect(khong.tuyChonLenh).toEqual({ ...tc, coBanKhong: true });
    expect(khong.laVuaChon).toBe(true);
    expect(tuyChonLenhChoShop(tc, 'chia_lenh').tuyChonLenh).toEqual({ ...tc, coChiaLenh: true });
    expect(tuyChonLenhChoShop(tc, 'mua_duoi')).toEqual({ tuyChonLenh: tc, laVuaChon: true });
  });

  it('màn trận: `nav` của shop TRẢI thẳng `tuyChonLenhChoShop(b.tuy_chon_lenh, chonCT)` — không bọc điều kiện nào', () => {
    const man = boChuThich(readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8')
      .replace(/\r\n/g, '\n'));
    const khoi = /nav=\{st\.ban\.vi_the !== undefined \? \{([\s\S]*?)\n\s*lenh: lenhNhap,/.exec(man)?.[1] ?? '';
    expect(khoi, 'không tìm thấy khối `nav` của shop ở màn trận').not.toBe('');
    expect(khoi).toMatch(/^\s*\.\.\.tuyChonLenhChoShop\(b\.tuy_chon_lenh, chonCT\),\s*$/m);
  });
});
