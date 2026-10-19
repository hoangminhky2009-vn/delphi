/**
 * D442 — NỀN BÀN THẺ ĐỔI THEO XU HƯỚNG + MẶT TRUNG TÍNH (founder 27/09 tối; lượt 2 sau khi xem ảnh 28/09).
 *
 *  §I   trạng thái = hàm thuần của `xu_huong` CÔNG KHAI (null ⇒ đi ngang).
 *  §II  cấu trúc: lớp nền nằm NGOÀI khung cuộn của dải ô, sau lưng lá, không nhận chạm, trình đọc bỏ qua; hạt tro
 *       đúng bảng cố định.
 *  §III luật chuyển động (01-vfx-game-feel.md): keyframe mới chỉ `transform` / `opacity`; tro + rung là VẬT ⇒ `steps()`;
 *       ánh sáng ⇒ ease-in-out; đổi trạng thái 0,5 s qua `--nhip-mt-doi`; giảm chuyển động tắt nháy nhưng giữ màu.
 *  §IV  mặt trung tính (chữ đứng thẳng trên nó): tương phản TÍNH LẠI từ token; nền môi trường (không mang chữ): trần độ đậm.
 *  §V   lượt 2 — chỉ RUNG khi trạng thái ĐỔI.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarketMap } from '../src/components/holdem/MarketMap';
import type { NhanDTO, ODTO } from '../src/api/holdem';
import { HAT_TRO, moiTruongCua } from '../src/lib/moi_truong';
import { HO_MAU } from '../src/lib/la_bai';
import { NHIP } from '../src/lib/nhip';

const CAT_GD: NhanDTO[] = [
  { id: 'tang', label: 'Đang lên', icon: '📈' },
  { id: 'giam', label: 'Đang xuống', icon: '📉' },
  { id: 'di_ngang', label: 'Đứng im', icon: '➖' },
];
const oGD = (gd: string): ODTO => ({ kind: 'giai_doan', giai_doan: gd } as ODTO);

const props = (xuHuong: { huong: number; dai: number } | null) => ({
  daLat: [oGD('tang'), oGD('tang'), oGD('tang')], hienTai: null, vong: 4, tongVong: 16, conLai: 12, art: {},
  giaiDoan: CAT_GD, suKien: [], telegraph: null, xuHuong, upO: true,
});
const ve = (xuHuong: { huong: number; dai: number } | null) => render(<MarketMap {...props(xuHuong)} />);

// Chuẩn hoá CRLF thành LF: tệp CSS trên Windows mang CRLF, tìm theo xuống dòng mà không chuẩn hoá thì bài xanh GIẢ
// hoặc đỏ oan (đã vấp một lần ở lượt 1).
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const bocChuThich = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = bocChuThich(doc('src/components/holdem/MarketMap.module.css'));
const TOKENS = bocChuThich(doc('src/styles/tokens.css'));
/** Thân rule đầu tiên có ĐÚNG bộ chọn `sel` (sau khi bóc chú thích). */
const than = (css: string, sel: string): string => {
  const i = css.indexOf(`${sel} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
};
/** Thân một @keyframes (gồm các khối con). */
const keyframes = (ten: string): string => {
  const i = CSS.indexOf(`@keyframes ${ten}`);
  if (i < 0) return '';
  let sau = 0;
  let j = CSS.indexOf('{', i);
  for (let k = j; k < CSS.length; k += 1) {
    if (CSS[k] === '{') sau += 1;
    if (CSS[k] === '}') { sau -= 1; if (sau === 0) { j = k; break; } }
  }
  return CSS.slice(i, j + 1);
};

describe('D442 §I — trạng thái từ xu_huong công khai', () => {
  it('null / hướng 0 ⇒ đi ngang · hướng > 0 ⇒ đi lên · hướng < 0 ⇒ đi xuống', () => {
    expect(moiTruongCua(null)).toBe('ngang');
    expect(moiTruongCua(undefined)).toBe('ngang');
    expect(moiTruongCua({ huong: 0 })).toBe('ngang');
    expect(moiTruongCua({ huong: 1 })).toBe('len');
    expect(moiTruongCua({ huong: -1 })).toBe('xuong');
  });
});

describe('D442 §II — cấu trúc', () => {
  const CA = [[null, 'ngang'], [{ huong: 1, dai: 3 }, 'len'], [{ huong: -1, dai: 2 }, 'xuong']] as const;
  for (const [xh, mt] of CA) {
    it(`xu_huong ${JSON.stringify(xh)} ⇒ data-moi-truong="${mt}"`, () => {
      const { container } = ve(xh);
      const nen = container.querySelector('[data-moi-truong]') as HTMLElement;
      expect(nen, 'thiếu khối nền môi trường').toBeTruthy();
      expect(nen.dataset.moiTruong).toBe(mt);
    });
  }

  it('⭐ lớp nền nằm NGOÀI khung cuộn dải ô, trình đọc màn hình bỏ qua; dải ô vẫn là con của khối nền', () => {
    const { container } = ve({ huong: -1, dai: 2 });
    const nen = container.querySelector('[data-moi-truong]') as HTMLElement;
    const map = container.querySelector('[aria-label^="Bản đồ"]') as HTMLElement;
    expect(map.parentElement, 'dải ô phải nằm trong khối nền').toBe(nen);
    const lop = [...nen.children].filter((e) => e !== map);
    expect(lop.length, 'phải có lớp nền + lớp quầng').toBeGreaterThanOrEqual(2);
    for (const e of lop) expect(e.getAttribute('aria-hidden'), 'lớp trang trí phải aria-hidden').toBe('true');
    // Không lớp nào nằm TRONG khung cuộn — lớp nền mà ở trong thì trôi theo ô khi cuộn.
    expect(map.querySelector('[data-lop]'), 'lớp nền lọt vào khung cuộn').toBeNull();
    for (const l of ['nen', 'quang', 'tro']) expect(nen.querySelector(`[data-lop="${l}"]`), `thiếu lớp ${l}`).toBeTruthy();
  });

  it('hạt tro đúng bảng cố định (tất định), cạnh 1–2 px, vị trí trong bề ngang bàn', () => {
    const { container } = ve({ huong: -1, dai: 2 });
    const hat = [...container.querySelectorAll('[data-lop="tro"] > i')] as HTMLElement[];
    expect(hat.length).toBe(HAT_TRO.length);
    hat.forEach((h, k) => {
      expect(h.style.getPropertyValue('--x')).toBe(`${HAT_TRO[k]!.x}%`);
      expect(h.style.getPropertyValue('--co')).toMatch(/^[12]px$/);
    });
    for (const h of HAT_TRO) { expect(h.x).toBeGreaterThan(0); expect(h.x).toBeLessThan(100); }
  });

  it('màu họ lá bơm inline từ HO_MAU — một nguồn với mặt lá', () => {
    const { container } = ve({ huong: 1, dai: 3 });
    const nen = container.querySelector('[data-moi-truong]') as HTMLElement;
    expect(nen.style.getPropertyValue('--ho-len')).toBe(HO_MAU.len.mau);
    expect(nen.style.getPropertyValue('--ho-xuong')).toBe(HO_MAU.xuong.mau);
    expect(nen.style.getPropertyValue('--ho-ngang')).toBe(HO_MAU.ngang.mau);
  });
});

describe('D442 §III — luật chuyển động', () => {
  const MOI = ['mtQuet', 'mtTho', 'mtLua', 'mtTro', 'mtSang', 'mtRungA', 'mtRungB'];

  it('⭐ bảy keyframe mới có mặt và CHỈ animate transform / opacity', () => {
    for (const ten of MOI) {
      const kf = keyframes(ten);
      expect(kf, `thiếu @keyframes ${ten}`).not.toBe('');
      const thuocTinh = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(thuocTinh.length, `${ten} rỗng`).toBeGreaterThan(0);
      for (const t of thuocTinh) expect(['transform', 'opacity'], `${ten} animate ${t}`).toContain(t);
    }
  });

  it('đổi trạng thái = opacity của lớp chồng, 0,5 s ease-in-out qua --nhip-mt-doi (không transition background)', () => {
    expect(NHIP.MT_DOI).toBe(500);
    const dau = CSS.indexOf('.nenNgang,\n.nenLen,');
    expect(dau, 'thiếu khối transition chung của các lớp').toBeGreaterThan(0);
    const khoi = CSS.slice(dau, CSS.indexOf('}', dau));
    expect(khoi).toMatch(/transition:\s*opacity var\(--nhip-mt-doi[^)]*\) ease-in-out/);
    // Chỉ xét khối D442 (tệp có sẵn rule cũ transition background — không thuộc việc này).
    expect(CSS.slice(CSS.indexOf('.mapNen {'))).not.toMatch(/transition:[^;]*background/);
    // Quầng tràn ra ngoài mép bàn (đặc tả: "ra không gian xung quanh") — rule riêng sau khối gộp `.nen, .nhomQuang`.
    expect(CSS).toMatch(/\.nhomQuang \{ inset: -5px; \}/);
  });

  it('tro + rung là VẬT ⇒ steps(); vệt lóe, thở, lửa, thở sáng là ÁNH SÁNG ⇒ ease-in-out', () => {
    expect(than(CSS, '.tro > i')).toMatch(/animation:\s*mtTro [^;]*steps\(/);
    expect(CSS).toMatch(/\.mapNen\[data-rung="a"\] \{ animation: mtRungA [^;]*steps\(/);
    expect(CSS).toMatch(/\.mapNen\[data-rung="b"\] \{ animation: mtRungB [^;]*steps\(/);
    expect(than(CSS, '.vetLoe')).toMatch(/animation:\s*mtQuet [^;]*ease-in-out/);
    expect(than(CSS, '.quang')).toMatch(/animation:\s*mtTho [^;]*ease-in-out/);
    expect(than(CSS, '.lua')).toMatch(/animation:\s*mtLua [^;]*ease-in-out/);
    expect(CSS).toMatch(/animation:\s*mtSang [^;]*ease-in-out/);
  });

  it('rung ngắn đúng khung quy chuẩn VFX (0,1–0,15 s)', () => {
    expect(NHIP.MT_RUNG).toBeGreaterThanOrEqual(100);
    expect(NHIP.MT_RUNG).toBeLessThanOrEqual(150);
  });

  // Đặc tả gốc 15–20 %; founder lượt 2 (xem ảnh): "làm màu hiệu ứng sáng hơn 1 tý" ⇒ nâng, vẫn là nền bổ trợ (≤ 35 %).
  it('quầng thở trong khoảng lượt 2 (sáng hơn đặc tả gốc một chút, không quá 35 %)', () => {
    const vals = [...keyframes('mtTho').matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...vals)).toBeLessThanOrEqual(0.35);
  });

  it('đi ngang TĨNH: lớp nền đi ngang không có animation nào, và không có lớp thở sáng', () => {
    expect(than(CSS, '.nenNgang')).not.toBe('');
    expect(than(CSS, '.nenNgang')).not.toContain('animation');
    expect(CSS).not.toContain('.thoNgang');
  });

  it('giảm chuyển động: tắt mọi animation mới + rung, GIỮ màu (nền không bị tắt, thở sáng đứng ở mức giữa)', () => {
    const i = CSS.indexOf('@media (prefers-reduced-motion: reduce)', CSS.indexOf('.mapNen {'));
    expect(i, 'thiếu nhánh giảm chuyển động').toBeGreaterThan(0);
    const khoi = CSS.slice(i, CSS.indexOf('\n}\n', i));
    for (const sel of ['.vetLoe', '.quang', '.lua', '.tro > i', '.thoLen', '.thoXuong', '[data-rung="a"]', '[data-rung="b"]']) {
      expect(khoi, `nhánh giảm chuyển động thiếu ${sel}`).toContain(sel);
    }
    expect(khoi).toContain('animation: none');
    expect(khoi).not.toMatch(/\.nen(Ngang|Len|Xuong)/);
    expect(khoi, 'thở sáng đứng yên ở mức giữa — GIỮ độ đậm').toMatch(/opacity: 0\.35/);
  });
});

/* ── §IV — mặt trung tính (có chữ) · nền môi trường (không chữ) ─────────────────────────────────────────── */
const hexToken = (ten: string): string => {
  const m = TOKENS.match(new RegExp(`${ten}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`thiếu token ${ten}`);
  return m[1]!;
};
const kenh = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** color-mix(in srgb, a P%, b) — pha tuyến tính từng kênh sRGB, đúng cách trình duyệt tính. */
const pha = (a: string, p: number, b: string): string => {
  const [x, y] = [kenh(a), kenh(b)];
  return '#' + x.map((v, i) => Math.round(v * p + y[i]! * (1 - p)).toString(16).padStart(2, '0')).join('');
};
const doSang = (h: string) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = kenh(h).map(f) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const tuongPhan = (a: string, b: string) => {
  const [x, y] = [doSang(a), doSang(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const CHU = ['--lose', '--win', '--text-muted'];

describe('D442 §IV — tương phản mặt có chữ · trần độ đậm nền không chữ', () => {
  it('⭐ mặt trung tính (dải sáu mã + thanh thao tác — chữ đứng THẲNG trên đó): mọi màu chữ ≥ 4,5:1 ở đỉnh lẫn đáy', () => {
    const day = hexToken('--mat-trung');
    const dinh = pha(hexToken('--mat-trung-sang'), 0.42, day);
    for (const c of CHU) {
      expect(tuongPhan(hexToken(c), day), `${c} trên đáy ${day}`).toBeGreaterThanOrEqual(4.5);
      expect(tuongPhan(hexToken(c), dinh), `${c} trên đỉnh ${dinh}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /*
   * Lượt 2 — nền môi trường KHÔNG phải mặt đặt chữ: mọi lá nằm trong khung có LÓT ĐỤC `--bg-page` (bài `ni_ban_choi` §II
   * canh), nên chữ không bao giờ đứng thẳng trên màu này — bài tương phản chữ của lượt 1 đo nhầm thứ. Thứ cần canh là ĐỘ
   * ĐẬM (đặc tả: nền bổ trợ, không rối mắt): founder xin đậm hơn ⇒ trần 42 % cho MỌI chỗ pha họ màu trong khối D442.
   */
  it('⭐ độ đậm nền môi trường có trần: mọi chỗ pha họ màu trong khối D442 ≤ 42 %', () => {
    const khoi = CSS.slice(CSS.indexOf('.mapNen {'));
    const phan = [...khoi.matchAll(/var\(--ho-(?:len|xuong|ngang)\) (\d+)%/g)].map((m) => Number(m[1]));
    expect(phan.length, 'khối D442 phải pha họ màu').toBeGreaterThan(5);
    expect(Math.max(...phan), 'nền quá đậm sẽ tranh chú ý với lá').toBeLessThanOrEqual(42);
  });

  it('lượt 2 đậm hơn lượt 1 (founder: "tăng độ đậm đi") — đáy mỗi nền từ 20 % trở lên', () => {
    for (const sel of ['.nenLen', '.nenXuong', '.nenNgang']) {
      const p = [...than(CSS, sel).matchAll(/var\(--ho-[a-z]+\) (\d+)%/g)].map((m) => Number(m[1]));
      expect(p.length, `${sel} phải pha họ màu`).toBeGreaterThan(0);
      expect(Math.min(...p), `${sel} chưa đậm hơn lượt 1`).toBeGreaterThanOrEqual(20);
    }
  });

  it('nền môi trường tối hơn mặt lá — lá vẫn là thứ sáng nhất trên bàn', () => {
    // Điểm sáng nhất có thể của nền (thở sáng ở đỉnh, pha 40 %) vẫn tối hơn chữ thường trên lá (`--text-muted`).
    const toi = hexToken('--nen-moi-truong');
    for (const ho of [HO_MAU.len.mau, HO_MAU.xuong.mau, HO_MAU.ngang.mau]) {
      expect(doSang(pha(ho, 0.42, toi))).toBeLessThan(doSang(hexToken('--text-muted')));
    }
  });
});

describe('D442 lượt 2 §V — chỉ RUNG khi trạng thái đổi', () => {
  it('⭐ mở màn không rung; đổi trạng thái ⇒ data-rung đổi a ↔ b; vẽ lại cùng trạng thái ⇒ giữ nguyên', () => {
    const { container, rerender } = render(<MarketMap {...props(null)} />);
    const rungNay = () => (container.querySelector('[data-moi-truong]') as HTMLElement).getAttribute('data-rung');
    expect(rungNay(), 'mở màn mà rung là rung vô cớ').toBeNull();
    rerender(<MarketMap {...props({ huong: 1, dai: 2 })} />);
    expect(rungNay(), 'ngang → lên phải rung').toBe('a');
    rerender(<MarketMap {...props({ huong: 1, dai: 3 })} />);
    expect(rungNay(), 'vẫn đi lên (chuỗi dài thêm) — không rung lại').toBe('a');
    rerender(<MarketMap {...props({ huong: -1, dai: 1 })} />);
    expect(rungNay(), 'lên → xuống phải rung lại (đổi tên keyframe)').toBe('b');
    rerender(<MarketMap {...props(null)} />);
    expect(rungNay()).toBe('a');
  });
});

/*
 * D442 lượt 3 (founder 28/09: "Cẩn thận bị quá tải hiệu ứng, phân thứ tự xuất hiện …") — nền đổi ở bước MÔI TRƯỜNG của
 * nhịp kết quả (prop `xuHuongNen`, màn trận chuyển nó SAU lá lật + tin), không cùng lúc lá lật; và suốt chuỗi, hiệu ứng
 * nền dịu + đứng (`dangDien`) — chỉ còn màu.
 */
describe('D442 lượt 3 §VI — nền theo bước MÔI TRƯỜNG · nhường sân khấu khi chuỗi đang diễn', () => {
  it('⭐ nền đi theo xuHuongNen (bước môi trường), KHÔNG theo xu hướng của lá vừa lật', () => {
    const { container } = render(<MarketMap {...props({ huong: 1, dai: 3 })} xuHuongNen={null} />);
    const nen = container.querySelector('[data-moi-truong]') as HTMLElement;
    expect(nen.dataset.moiTruong, 'lá đã lật lên nhưng bước môi trường chưa tới ⇒ nền vẫn trạng thái cũ').toBe('ngang');
    // Gạch chân ô đang lật vẫn đi cùng lá.
    expect((container.querySelector('[data-xu-huong]') as HTMLElement).dataset.xuHuong).toBe('len');
  });

  it('dangDien ⇒ data-dien có mặt; hết diễn ⇒ vắng', () => {
    const { container, rerender } = render(<MarketMap {...props(null)} dangDien />);
    const nen = () => container.querySelector('[data-moi-truong]') as HTMLElement;
    expect(nen().hasAttribute('data-dien')).toBe(true);
    rerender(<MarketMap {...props(null)} dangDien={false} />);
    expect(nen().hasAttribute('data-dien')).toBe(false);
  });

  it('CSS: khi diễn, nhóm hiệu ứng DỊU (25 %) và mọi animation nền ĐỨNG; màu nền không bị đụng', () => {
    const dau = CSS.indexOf('.mapNen[data-dien][data-moi-truong="len"] .nhomLen');
    expect(dau, 'thiếu luật nhường sân khấu').toBeGreaterThan(0);
    const khoi = CSS.slice(dau, CSS.indexOf('}', CSS.indexOf('animation-play-state', dau)) + 1);
    expect(khoi).toContain('opacity: 0.25');
    for (const sel of ['.vetLoe', '.thoLen', '.thoXuong', '.quang', '.lua', '.tro > i']) {
      expect(khoi, `thiếu ${sel} trong luật đứng yên`).toContain(`.mapNen[data-dien] ${sel}`);
    }
    expect(khoi).toContain('animation-play-state: paused');
    expect(khoi, 'màu nền không được dịu khi diễn — đó là thứ duy nhất còn báo trạng thái').not.toMatch(/nen(Ngang|Len|Xuong)/);
  });
});

/*
 * D442 lượt 3 §VII — DÂY NỐI trong màn trận. Ba mối nối mà không bài render nào chạm tới: thiếu một mối là nền đổi
 * cùng lúc lá lật (quá tải — đúng điều founder dặn tránh) hoặc bước MÔI TRƯỜNG không bao giờ có thời lượng.
 */
describe('D442 lượt 3 §VII — dây nối màn trận', () => {
  const man = bocChuThich(doc('src/screens/holdem/AlphaDraftMatch.tsx'));

  it('⭐ bước MÔI TRƯỜNG chỉ có thời lượng khi trạng thái nền ĐỔI giữa trước/sau vòng (cùng hàm `moiTruongCua`)', () => {
    expect(man).toMatch(/const doiMoiTruong = !!stTruoc && moiTruongCua\(stTruoc\.xu_huong\) !== moiTruongCua\(tt\.xu_huong\);/);
    expect(man).toMatch(/lichKetQua\(\{[^}]*doiMoiTruong/);
  });

  it('⭐ nền giữ trạng thái TRƯỚC vòng cho tới khi chuỗi tới bước MÔI TRƯỜNG', () => {
    expect(man).toMatch(/const stNen = !daToiBuoc\(buocKq, 'moi_truong'\) && ketQuaCho\?\.stTruoc \? ketQuaCho\.stTruoc : st;/);
    expect(man).toMatch(/xuHuongNen=\{stNen\.xu_huong \?\? null\}/);
  });

  it('suốt chuỗi kết quả (kể cả lúc chờ lá lật) nền nhường sân khấu', () => {
    expect(man).toMatch(/dangDien=\{dangDienKq \|\| choDienXong\}/);
  });
});
