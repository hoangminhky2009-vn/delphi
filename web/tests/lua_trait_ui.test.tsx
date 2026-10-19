/**
 * v55 (D409) — LỬA · XU · TRAIT · CHỐT LỜI ở mặt người chơi NHÌN THẤY.
 *
 * Mỗi mục có vế ngược (trận không cổng ⇒ không một pixel nào đổi — nếp `up_o`):
 *   §I   ngọn lửa đà: nấc → hình + số glyph; lên NẢY, giảm DẬP; reduced-motion đứng yên đúng nấc; @keyframes chỉ
 *        transform/opacity; thanh phong cách có `lua` mới có khe;
 *   §II  khay + chợ trait (D422 — theo trang demo đã chốt): chữ ở client theo id; chạm thẻ mở bảng xác nhận, LẤY thì
 *        chọn; cái cân nói CÂN 0 / LỆCH; XONG khi lệch không đóng; CUỘN LẠI khoá khi thiếu xu hoặc hết lượt;
 *   §III chốt lời trong ô: mốc mục tiêu trong biên server gửi; chip gọi `onDoi` đúng số; trần số lệnh;
 *   §IV  hàng chip đọc `mocChoPhep`: LỆNH MỊN thêm 10%, bộ server thiếu mốc nào thì bỏ mốc ấy (không lá nào còn cấm — D425), mặt RÚT/KHỐNG không đổi;
 *   §V   dây chuyền VÌ SAO: kind mới có nhãn RIÊNG (không rơi vào "chưa có nhãn"); KỶ LUẬT gọi tên trait;
 *   §VI  bản đồ: lá che (MÙ TIN) · lá hai mặt (SƯƠNG MÙ) · nội gián · reel — và dải đối thủ có lửa;
 *   §VII chữ lỗi lệnh mới + công của lá.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LuaMomentum } from '../src/components/holdem/LuaMomentum';
import { ThanhPhongCach } from '../src/components/holdem/ThanhPhongCach';
import { KhayTrait } from '../src/components/holdem/KhayTrait';
import { ChoTrait, NutCuonTrait } from '../src/components/holdem/ChoTrait';
import { ChotLoi, mocMucTieu } from '../src/components/holdem/ChotLoi';
import { HangChip, mocsCuaMat } from '../src/components/holdem/HangChip';
import { ChainReveal } from '../src/components/holdem/ChainReveal';
import { MarketMap } from '../src/components/holdem/MarketMap';
import { DoiThuStrip } from '../src/components/holdem/DoiThuStrip';
import { chuLoiLenh } from '../src/lib/loi_lenh';
import { laCuaMatXich } from '../src/lib/tra_cong';
import { TRAIT_CHU, diemChu, loaiCua, tongDiemChon } from '../src/lib/trait_chu';
import { nhanVi, viConLai, viDoiBai } from '../src/lib/vi_xu';
import { CHO_TRAIT, TRAIT, diemCoDau } from '@config/trait';
import { LUOT_SONG_MOI } from '@config/luot_song';
import type { DoiThuDTO, KetQuaGheDTO, KetQuaVongDTO, MatXichDTO, NhanDTO, ODTO } from '../src/api/holdem';

const TAI = TRAIT.filter((t) => t.loai === 'tai' && !t.vai);
const TAT = TRAIT.filter((t) => t.loai === 'tat' && !t.vai);

/** Một lượt mời hợp lệ: 3 TÀI + 3 TẬT tổng 0 — dựng từ chính bảng config, không gõ id. */
function luotMoiCan(): string[] {
  for (let a = 0; a < TAI.length; a += 1) for (let b = a + 1; b < TAI.length; b += 1) for (let c = b + 1; c < TAI.length; c += 1) {
    const tai = [TAI[a]!, TAI[b]!, TAI[c]!];
    const tong = tai.reduce((s, t) => s + diemCoDau(t), 0);
    for (let x = 0; x < TAT.length; x += 1) for (let y = x + 1; y < TAT.length; y += 1) for (let z = y + 1; z < TAT.length; z += 1) {
      const tat = [TAT[x]!, TAT[y]!, TAT[z]!];
      if (tong + tat.reduce((s, t) => s + diemCoDau(t), 0) === 0) return [...tai, ...tat].map((t) => t.id);
    }
  }
  throw new Error('bảng trait không dựng được một lượt mời cân 0');
}

/** matchMedia giả: bật/tắt prefers-reduced-motion cho một khối. */
function voiReducedMotion<T>(bat: boolean, f: () => T): T {
  const goc = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    matches: bat && q.includes('prefers-reduced-motion'), media: q,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
    dispatchEvent: () => false, onchange: null,
  })) as unknown as typeof window.matchMedia;
  try { return f(); } finally { window.matchMedia = goc; }
}

describe('§I ngọn lửa đà', () => {
  it('nấc 0 = than không số; lên nấc ⇒ NẢY (data-nhip=nay); giảm nấc ⇒ DẬP kèm lý do', () => {
    const { container, rerender } = render(<LuaMomentum nac={0} />);
    const lua0 = container.querySelector('[data-tap="lua"]')!;
    expect(lua0.getAttribute('data-nac')).toBe('0');
    expect(lua0.getAttribute('aria-label')).toMatch(/tàn/);
    expect(lua0.hasAttribute('data-nhip')).toBe(false);
    // Ba khung hình flicker vẽ bằng box-shadow — than luôn có (hai hàng đáy), không tia.
    const khung = [...lua0.querySelectorAll(':scope > i')] as HTMLElement[];
    expect(khung.length).toBe(3);
    expect(khung.every((k) => k.style.boxShadow !== '')).toBe(true);

    rerender(<LuaMomentum nac={3} />);
    const lua3 = container.querySelector('[data-tap="lua"]')!;
    expect(lua3.getAttribute('data-nac')).toBe('3');
    expect(lua3.getAttribute('data-nhip')).toBe('nay');
    expect(lua3.getAttribute('aria-label')).toMatch(/nấc 3/);
    // D443 — số nấc đi bằng font app (một font cho cả màn), vẫn không chữ "x" (D47).
    expect(lua3.textContent).toBe('3');
    expect([...lua3.querySelectorAll(':scope > i')].length, 'nấc 3: ba khung + một cụm tia').toBe(4);

    rerender(<LuaMomentum nac={1} dap="doi_bias" />);
    const lua1 = container.querySelector('[data-tap="lua"]')!;
    expect(lua1.getAttribute('data-nhip')).toBe('dap');
    expect(lua1.getAttribute('data-dap')).toBe('doi_bias');
  });

  it('lửa ĐẶC BIỆT đổi bảng màu (xanh→tím), lửa thường cam→vàng — cùng một lưới', () => {
    const mau = (dacBiet: boolean) => {
      const { container, unmount } = render(<LuaMomentum nac={2} dacBiet={dacBiet} />);
      const s = ([...container.querySelectorAll('[data-tap="lua"] > i')] as HTMLElement[]).map((e) => e.style.boxShadow).join('|');
      unmount();
      return s;
    };
    expect(mau(false)).toMatch(/#ff6b1a|rgb\(255, 107, 26\)/);
    expect(mau(false)).not.toMatch(/#4fc3f7|rgb\(79, 195, 247\)/);
    expect(mau(true)).toMatch(/#4fc3f7|rgb\(79, 195, 247\)/);
  });

  it('prefers-reduced-motion: đứng yên đúng nấc, không nhịp nảy/dập — thông tin còn, chuyển động mất', () => {
    voiReducedMotion(true, () => {
      const { container, rerender } = render(<LuaMomentum nac={1} />);
      rerender(<LuaMomentum nac={2} />);
      const lua = container.querySelector('[data-tap="lua"]')!;
      expect(lua.getAttribute('data-nac')).toBe('2');
      expect(lua.hasAttribute('data-nhip')).toBe(false);
      expect(lua.className).toMatch(/tinh/);
    });
  });

  it('⭐ @keyframes của lửa chỉ animate transform/opacity (A11.18 · §2.5 vfx)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/holdem/LuaMomentum.module.css'), 'utf8');
    // Khối keyframes một dòng hay nhiều dòng đều bắt: thân = các khối `{…}` con + phần còn lại, tới ngoặc đóng ngoài.
    const khoi = [...css.matchAll(/@keyframes\s+(\w+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)];
    expect(khoi.length).toBeGreaterThanOrEqual(7);
    for (const [, ten, than] of khoi) {
      const thuocTinh = [...than!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(thuocTinh.length, `keyframes ${ten} rỗng`).toBeGreaterThan(0);
      for (const t of thuocTinh) expect(['transform', 'opacity'], `keyframes ${ten} animate "${t}"`).toContain(t);
    }
    // Tên keyframe đứng TRƯỚC trong shorthand — không có `animation: <số>ms tên`.
    expect(css).not.toMatch(/animation:\s*\d/);
  });

  it('D422 — MÙ LỬA: khe lửa vẽ lá bịt mắt (hình MÙ LỬA), KHÔNG vẽ ngọn lửa tàn; không mang ⇒ ngọn lửa như cũ (vế ngược)', () => {
    const pc = { hang: 'binh_thuong', diem: 0, streak: 0 } as never;
    const { container, unmount } = render(<ThanhPhongCach pc={pc} lua={{ nac: 0, muLua: true }} />);
    const o = container.querySelector('[data-mu-lua]');
    expect(o, 'mang MÙ LỬA mà khe lửa không vẽ lá bịt mắt').not.toBeNull();
    expect(o?.querySelector('svg path')).not.toBeNull();
    expect(o?.getAttribute('aria-label')).toContain('MÙ LỬA');
    expect(container.querySelector('[data-tap="lua"]'), 'MÙ LỬA mà vẫn vẽ than tàn — đọc nhầm thành mất lửa').toBeNull();
    unmount();
    const { container: c2 } = render(<ThanhPhongCach pc={pc} lua={{ nac: 2 }} />);
    expect(c2.querySelector('[data-mu-lua]')).toBeNull();
    expect(c2.querySelector('[data-tap="lua"]')?.getAttribute('data-nac')).toBe('2');
  });

  it('ThanhPhongCach: có `lua` ⇒ ngọn lửa ở khe phải; không có ⇒ không một phần tử nào (vế ngược)', () => {
    const pc = { diem: 500, hang: 'C', streak: 0 };
    const { container, rerender } = render(<ThanhPhongCach pc={pc} lua={{ nac: 2 }} />);
    expect(container.querySelector('[data-tap="lua-o"] [data-tap="lua"]')?.getAttribute('data-nac')).toBe('2');
    rerender(<ThanhPhongCach pc={pc} />);
    expect(container.querySelector('[data-tap="lua-o"]')).toBeNull();
    expect(container.querySelector('[data-tap="lua"]')).toBeNull();
  });
});

describe('§II khay + chợ trait', () => {
  it('tự điển phủ đủ mọi id trong config, điểm có dấu, loại đúng bảng', () => {
    for (const t of TRAIT) {
      expect(TRAIT_CHU[t.id]?.ten, `thiếu chữ cho ${t.id}`).toBeTruthy();
      expect(TRAIT_CHU[t.id]?.luat, `thiếu câu luật cho ${t.id}`).toBeTruthy();
      expect(diemChu(t.id)).toMatch(t.loai === 'tai' ? /^\+\d$/ : /^−\d$/);
      expect(loaiCua(t.id)).toBe(t.vai ? 'vai' : t.loai);
    }
  });

  it('KhayTrait: rỗng ⇒ không vẽ (vế ngược); huy hiệu có HÌNH theo họ màu; lá chờ viền đứt "TỪ VÒNG n"; chạm ⇒ bảng xem không có nút lấy; không ô xu (D411)', () => {
    const { container: c0 } = render(<KhayTrait trait={[]} />);
    expect(c0.querySelector('[data-tap="khay-trait"]')).toBeNull();
    const { container, unmount } = render(<KhayTrait trait={[TAI[0]!.id, TAT[0]!.id]} choSau={[TAI[1]!.id]} tuVong={6} />);
    const huy = container.querySelectorAll('[data-trait]');
    expect(huy.length).toBe(3);
    expect(huy[0]!.getAttribute('data-loai')).toBe('tai');
    expect(huy[1]!.getAttribute('data-loai')).toBe('tat');
    expect(huy[0]!.querySelector('svg path'), 'huy hiệu phải có hình pixel').not.toBeNull();
    expect(huy[2]!.hasAttribute('data-cho-sau')).toBe(true);
    expect(huy[2]!.textContent).toContain('TỪ VÒNG 6');
    expect(container.textContent).toContain(TRAIT_CHU[TAI[0]!.id].ten);
    expect(container.querySelector('[data-tap="xu"]'), 'xu đã dời về ô ví — khay chỉ còn trait').toBeNull();
    fireEvent.click(huy[1]!);
    const tam = document.body.querySelector('[data-tap="tam-trait"]');
    expect(tam?.getAttribute('data-trait')).toBe(TAT[0]!.id);
    expect(tam?.textContent).toContain(TRAIT_CHU[TAT[0]!.id].luat);
    expect(document.body.querySelector('[data-tap="lay-trait"]'), 'bảng XEM không có nút lấy').toBeNull();
    unmount();
    const { container: c2 } = render(<KhayTrait trait={[]} teLiet />);
    expect(c2.querySelector('[data-te-liet]')).not.toBeNull();
    const { container: c3 } = render(<KhayTrait trait={[]} rongKhiTrong />);
    expect(c3.textContent).toContain('Chưa lấy lá nào');
  });

  it('ChoTrait: ba TÀI một hàng, ba TẬT một hàng; chạm thẻ ⇒ bảng xác nhận (luật + câu cân sau lượt); LẤY ⇒ chọn; cân về 0 bằng một TẬT cùng điểm', () => {
    const moi = luotMoiCan();
    expect(tongDiemChon(moi)).toBe(0);
    const chon: string[] = [];
    const ve = () => (
      <ChoTrait
        moc={5} moi={moi} xu={0} lanCuon={0}
        chon={[...chon]} onChon={(id) => { const i = chon.indexOf(id); if (i >= 0) chon.splice(i, 1); else chon.push(id); }}
      />
    );
    const { container, rerender } = render(ve());
    expect(container.querySelectorAll('[data-hang="tai"] [data-trait]').length).toBe(3);
    expect(container.querySelectorAll('[data-hang="tat"] [data-trait]').length).toBe(3);
    expect(container.querySelector('[data-tap="cho-trait"]')?.getAttribute('data-can')).toBe('0');
    expect(container.querySelector('[data-tap="can-trait"]')?.textContent).toBe('CÂN 0');

    const tai = moi.find((id) => loaiCua(id as never) === 'tai')!;
    const dTai = diemCoDau(TRAIT.find((t) => t.id === tai)!);
    fireEvent.click(container.querySelector(`[data-trait="${tai}"]`)!);
    expect(chon, 'chạm thẻ chỉ MỞ bảng, chưa lấy').toEqual([]);
    const tam = document.body.querySelector('[data-tap="tam-trait"]')!;
    expect(tam.getAttribute('data-trait')).toBe(tai);
    expect(tam.textContent).toContain(TRAIT_CHU[tai as keyof typeof TRAIT_CHU].luat);
    expect(document.body.querySelector('[data-tap="cau-can-tam"]')?.textContent).toContain(`cân +${dTai}`);
    fireEvent.click(document.body.querySelector('[data-tap="lay-trait"]')!);
    expect(chon).toEqual([tai]);
    rerender(ve());
    expect(container.querySelector('[data-tap="cho-trait"]')?.getAttribute('data-can')).toBe(String(dTai));
    expect(container.querySelector('[data-tap="can-trait"]')?.textContent).toBe(`LỆCH +${dTai}`);
    expect(container.querySelector(`[data-trait="${tai}"]`)?.getAttribute('aria-pressed')).toBe('true');

    const tat = moi.find((id) => loaiCua(id as never) === 'tat' && diemCoDau(TRAIT.find((t) => t.id === id)!) === -dTai);
    if (tat) {
      fireEvent.click(container.querySelector(`[data-trait="${tat}"]`)!);
      expect(document.body.querySelector('[data-tap="cau-can-tam"]')?.textContent).toContain('cân về 0');
      expect(document.body.querySelector('[data-tap="lay-trait"]')?.textContent).toBe('NHẬN TRAIT NÀY');
      fireEvent.click(document.body.querySelector('[data-tap="lay-trait"]')!);
      rerender(ve());
      expect(container.querySelector('[data-tap="can-trait"]')?.textContent).toBe('CÂN 0');
    }
  });

  it('D430 → D432 — chợ ở MÀN CHỌN: không XONG; `rungCan` đổi ⇒ cái cân rung (dựng lần đầu thì không); thẻ CỠ THƯỜNG; hàng đang mang', () => {
    const moi = luotMoiCan();
    const tai = moi.find((id) => loaiCua(id as never) === 'tai')!;
    const goc = { moc: 6, moi, xu: 4, lanCuon: 0, onChon: () => {} };
    const { container, rerender } = render(<ChoTrait {...goc} chon={[tai]} dangMang={['ghim_don_bay']} />);
    expect(container.querySelector('[data-tap="xong-trait"]'), 'chợ không có nút XONG (nút chính ở đáy màn chọn)').toBeNull();
    const can = () => container.querySelector('[data-tap="can-trait"]')!;
    expect(can().className, 'dựng lần đầu mà cái cân đã rung').not.toMatch(/canRung/);
    rerender(<ChoTrait {...goc} chon={[tai]} dangMang={['ghim_don_bay']} rungCan={1} />);
    expect(can().className, 'màn nộp vòng chặn CHỐT mà cái cân không rung').toMatch(/canRung/);
    const dTai = diemCoDau(TRAIT.find((t) => t.id === tai)!);
    expect(document.body.querySelector('[data-tap="bao-trait"]')?.textContent, 'chặn mà không nói lệch bao nhiêu').toContain(`lệch +${dTai}`);
    // D432 — chợ có trọn MÀN CHỌN nên sáu thẻ về CỠ THƯỜNG của demo (D430 dùng thẻ gọn vì chen chỗ hàng lõi)
    const the = [...container.querySelectorAll('[data-hang] [data-trait]')];
    expect(the.length).toBe(6);
    expect(the.some((e) => /gon/.test(e.className)), 'màn chọn mà thẻ vẫn là thẻ gọn').toBe(false);
    // hàng đang mang: lá đang giữ + lá vừa chọn (viền đứt)
    const khay = container.querySelector('[data-tap="khay-trait"]')!;
    expect(khay.querySelector('[data-trait="ghim_don_bay"]')).not.toBeNull();
    expect(khay.querySelector('[data-cho-sau]')?.getAttribute('data-trait')).toBe(tai);
    // D432 — mặt nỉ của demo (founder: "Chợ trait ko đẹp bằng demo"): ví XU ở đầu chợ, nhãn hàng TÀI / TẬT; "TỪ VÒNG n"
    // in trên huy hiệu lá vừa lấy ở khay ĐANG MANG (bản đủ), không nằm trong một dòng chữ.
    const cho = container.querySelector('[data-tap="cho-trait"]')!;
    expect(cho.textContent).toMatch(/XU\s*4/);
    expect(cho.textContent).toContain('MỐC VÒNG 6');
    expect(cho.querySelector('[data-hang="tai"]')?.textContent).toContain('TÀI');
    expect(cho.querySelector('[data-hang="tat"]')?.textContent).toContain('TRAIT');
    expect(khay.textContent).toContain('TỪ VÒNG 7');
    // D430 → D432 — nút đổi lại KHÔNG ở đầu chợ: nó ở ĐÁY màn chọn, cạnh nút chính (bài `shop_man_chon` §II)
    expect(container.querySelector('[data-tap="cuon-trait"]'), 'nút cuộn vẫn nằm ở đầu chợ').toBeNull();
  });

  it('CUỘN LẠI (`NutCuonTrait`): khoá khi xu < giá lần kế · mở khi đủ · HẾT CUỘN khi chạm trần; chữ nói ĐÍCH (TRAIT)', () => {
    const goc = { giaCuon: CHO_TRAIT.GIA_CUON_XU, cuonToiDa: CHO_TRAIT.CUON_TOI_DA };
    let goi = 0;
    const gia0 = CHO_TRAIT.GIA_CUON_XU[0]!;
    const { container, rerender } = render(<NutCuonTrait {...goc} xu={gia0 - 1} lanCuon={0} onCuon={() => { goi += 1; }} />);
    const nut = () => container.querySelector('[data-tap="cuon-trait"]') as HTMLButtonElement;
    expect(nut().disabled, 'thiếu xu mà vẫn cuộn được').toBe(true);
    expect(nut().getAttribute('aria-label')).toContain(`${gia0} xu`);
    expect(nut().textContent, 'giá in trên nút (mẩu đồng xu)').toMatch(new RegExp(`${gia0}$`));
    rerender(<NutCuonTrait {...goc} xu={gia0} lanCuon={0} onCuon={() => { goi += 1; }} />);
    expect(nut().textContent, 'nút đổi lại phải nói nó đổi TRAIT, không phải tài sản').toMatch(/ĐỔI TRAIT/);
    expect(nut().disabled).toBe(false);
    fireEvent.click(nut());
    expect(goi).toBe(1);
    rerender(<NutCuonTrait {...goc} xu={99} lanCuon={CHO_TRAIT.CUON_TOI_DA} onCuon={() => { goi += 1; }} />);
    expect(nut().disabled).toBe(true);
    expect(nut().textContent).toBe('HẾT LƯỢT ĐỔI');
  });
});

describe('§III chốt lời trong ô', () => {
  const cp = {
    nguong_min_bp: LUOT_SONG_MOI.NGUONG_MIN_BP, nguong_max_bp: LUOT_SONG_MOI.NGUONG_MAX_BP,
    buoc_bp: LUOT_SONG_MOI.NGUONG_BUOC_BP, phan_ban: LUOT_SONG_MOI.PHAN_BAN_CHO_PHEP, toi_da: LUOT_SONG_MOI.LENH_TOI_DA,
  };
  it('mốc mục tiêu nằm trong biên server gửi, là bội của bước, tăng dần', () => {
    const ds = mocMucTieu(cp);
    expect(ds.length).toBeGreaterThanOrEqual(4);
    for (const m of ds) {
      expect(m).toBeGreaterThanOrEqual(cp.nguong_min_bp);
      expect(m).toBeLessThanOrEqual(cp.nguong_max_bp);
      expect(m % cp.buoc_bp).toBe(0);
    }
    expect([...ds].sort((a, b) => a - b)).toEqual(ds);
    // Biên hẹp bất thường vẫn ra ít nhất một mốc (không rỗng, không văng).
    expect(mocMucTieu({ ...cp, nguong_min_bp: 2900, nguong_max_bp: 2950 })).toEqual([2900]);
  });

  it('không giữ mã ⇒ không vẽ; chạm mục tiêu ⇒ `onDoi` mang mục tiêu + phần mặc định; có lệnh mới hiện hàng phần và BỎ', () => {
    const ten = (m: string) => ({ btc: 'Crypto', vang: 'Vàng' }[m] ?? m);
    const { container: c0 } = render(<ChotLoi maDangGiu={[]} tenMa={ten} choPhep={cp} lenh={[]} onDoi={() => {}} />);
    expect(c0.querySelector('[data-tap="chot-loi"]')).toBeNull();
    const goi: unknown[] = [];
    const { container, rerender } = render(
      <ChotLoi maDangGiu={['btc', 'vang']} tenMa={ten} choPhep={cp} lenh={[]} onDoi={(ma, l) => goi.push([ma, l])} />,
    );
    expect(container.querySelectorAll('[data-ma]').length).toBe(2);
    expect(container.querySelector('[data-hang="phan"]')).toBeNull();
    const chip = container.querySelector('[data-ma="btc"] [data-nguong]') as HTMLButtonElement;
    fireEvent.click(chip);
    expect(goi).toEqual([['btc', { nguong_bp: Number(chip.getAttribute('data-nguong')), phan_bp: cp.phan_ban[1] }]]);
    rerender(
      <ChotLoi maDangGiu={['btc', 'vang']} tenMa={ten} choPhep={cp} lenh={[{ ma: 'btc', nguong_bp: 500, phan_bp: 5000 }]} onDoi={(ma, l) => goi.push([ma, l])} />,
    );
    expect(container.querySelector('[data-ma="btc"]')?.getAttribute('data-co-lenh')).toBe('1');
    expect(container.querySelectorAll('[data-ma="btc"] [data-phan]').length).toBe(cp.phan_ban.length);
    fireEvent.click(container.querySelector('[data-tap="bo-chot-loi"]')!);
    expect(goi[goi.length - 1]).toEqual(['btc', null]);
  });

  it('chạm trần số lệnh ⇒ mã chưa có lệnh bị khoá, mã đã có vẫn sửa được', () => {
    const lenh = [{ ma: 'a', nguong_bp: 500, phan_bp: 5000 }, { ma: 'b', nguong_bp: 500, phan_bp: 5000 }, { ma: 'c', nguong_bp: 500, phan_bp: 5000 }];
    const { container } = render(
      <ChotLoi maDangGiu={['a', 'b', 'c', 'd']} tenMa={(m) => m} choPhep={{ ...cp, toi_da: 3 }} lenh={lenh} onDoi={() => {}} />,
    );
    expect((container.querySelector('[data-ma="d"] [data-nguong]') as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector('[data-ma="a"] [data-nguong]') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('§IV hàng chip đọc `mocChoPhep`', () => {
  it('LỆNH MỊN thêm 10% · bộ server thiếu 100% thì bỏ 100% · Chia Lệnh giữ 20 nấc (không nhân đôi 10%) · RÚT/KHỐNG không đổi', () => {
    expect(mocsCuaMat('mua', 2500, [1000, 2500, 5000, 7500, 10000])).toEqual([1000, 2500, 5000, 7500, 10000]);
    expect(mocsCuaMat('mua', 2500, [2500, 5000, 7500])).toEqual([2500, 5000, 7500]);
    const chia = mocsCuaMat('mua', 500, [1000, 2500, 5000, 7500]);
    expect(chia.length).toBe(19);
    expect(chia.filter((m) => m === 1000).length).toBe(1);
    expect(chia).not.toContain(10000);
    expect(mocsCuaMat('mua', 2500)).toEqual([2500, 5000, 7500, 10000]);
    expect(mocsCuaMat('khong', 2500, [1000, 2500, 5000, 7500])).toEqual([2500, 5000, 7500, 10000]);
    expect(mocsCuaMat('ban', 2500, [2500, 5000, 7500])).toEqual([2500, 5000, 7500, 10000]);
  });

  it('render: bỏ 100% ⇒ không còn nút ALL-IN; thêm 10% ⇒ có chip 10%; vắng prop ⇒ y như cũ', () => {
    const KHUNG = {
      onDoiMat: () => {}, coBanKhong: false, coCocRut: false, buocMocBp: 2500, chipCam: null, onChamChip: () => {},
      chipVoHieu: false, allDangNhip: 0, lenh: [], tenMa: (m: string) => m, onXoa: () => {}, lapDuoc: false,
    };
    const { unmount } = render(<HangChip {...KHUNG} mat="mua" mocChoPhep={[1000, 2500, 5000, 7500]} />);
    expect(screen.queryByText('ALL-IN')).toBeNull();
    expect(screen.getByText('10%')).toBeInTheDocument();
    unmount();
    render(<HangChip {...KHUNG} mat="mua" />);
    expect(screen.getByText('ALL-IN')).toBeInTheDocument();
    expect(screen.queryByText('10%')).toBeNull();
  });
});

describe('§V dây chuyền VÌ SAO — ba kind mới', () => {
  const TAI_SAN = [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro' as const, thanh_khoan: 'mong' as const, bien_dong_bp: 400 }];
  const CHIEN_THUAT = [{ id: 'luot_song', label: 'Lướt Sóng', icon: '🌊', mo_ta: '', pham_vi: 'tai_san' as const }];
  const ve = (chain: MatXichDTO[]) => {
    const kq: KetQuaVongDTO = {
      vong: 3, o: { kind: 'giai_doan', giai_doan: 'giam' }, tin_gia_lo: null, quy_vong: 4000, ghe_thang: 'ban', chay_vong_nay: [],
      cua_ban: { ghe_id: 'ban', pnl_bp: 500, da_cat_lo: false, cam_ket: 500, von_truoc: 10000, von_sau: 10500, chain, hanh_dong: 'giu_vi_the', da_hit: false },
      cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
    } as unknown as KetQuaVongDTO;
    return render(<ChainReveal kq={kq} deltaVon={500} taiSan={TAI_SAN} chienThuat={CHIEN_THUAT} giaiDoan={[{ id: 'giam', label: 'Giảm', icon: '📉' }]} suKien={[]} />);
  };
  it('CHỐT NON · chốt lời trong ô · lửa đà thuận/đảo — mỗi cái một nhãn riêng, không "chưa có nhãn"', () => {
    voiReducedMotion(true, () => {
      ve([
        { kind: 'chot_non_tran', truoc_tran_bp: 4000, tran_bp: 2500, delta_bp: -1500 },
        { kind: 'song', ma: 'btc', nguong_bp: 800, dinh_bp: 1100, phan_bp: 5000, delta_bp: 150 },
        { kind: 'lua', ma: 'btc', nac: 2, thuan: true, he_so_bp: 500, delta_bp: 40 },
        { kind: 'lua', ma: 'btc', nac: 2, thuan: false, he_so_bp: 1000, delta_bp: -80 },
      ]);
      const chu = document.body.textContent ?? '';
      expect(chu).toMatch(/CHỐT NON.*trần cắt/);
      expect(chu).toMatch(/Lướt Sóng · chốt lời BTC ở \+8,00% \(đỉnh sóng \+11,00%\) — 50% vị thế/);
      expect(chu).toMatch(/Lửa đà nấc 2 — BTC THUẬN/);
      expect(chu).toMatch(/Lửa đà nấc 2 — BTC ĐẢO/);
      expect(chu).not.toMatch(/chưa có nhãn/);
    });
  });
  it('D422 — KIÊN NHẪN · NÓNG VỘI theo mã; sàn và phí của KỶ LUẬT gọi tên trait khi đang mang, gọi tên lá khi không (vế ngược); tin/pha bị che không lộ tên', () => {
    voiReducedMotion(true, () => {
      const chain: MatXichDTO[] = [
        { kind: 'kien_nhan', ma: 'btc', giu_vong: 3, he_so_bp: 1000, delta_bp: 30 },
        { kind: 'nong_voi', ma: 'btc', giu_vong: 4, he_so_bp: 2500, delta_bp: -70 },
        { kind: 'chan_lo_san', truoc_san_bp: -3100, san_bp: -1500, delta_bp: 1600 },
        { kind: 'dac_quyen', id: 'chan_lo', ly_do: 'phi_bao_hiem', delta_bp: -60 } as MatXichDTO,
        { kind: 'echo', id: 'btc', su_kien: 'che', delta_bp: -200 } as MatXichDTO,
      ];
      const kq = {
        vong: 3, o: { kind: 'che' }, tin_gia_lo: null, quy_vong: 4000, ghe_thang: 'ban', chay_vong_nay: [],
        cua_ban: { ghe_id: 'ban', pnl_bp: 500, da_cat_lo: false, cam_ket: 500, von_truoc: 10000, von_sau: 10500, chain, hanh_dong: 'giu_vi_the', da_hit: false },
        cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
      } as unknown as KetQuaVongDTO;
      const TS = [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro' as const, thanh_khoan: 'mong' as const, bien_dong_bp: 400 }];
      const CT = [{ id: 'chan_lo', label: 'Chặn Lỗ', icon: '🛡', mo_ta: '', pham_vi: 'danh_muc' as const }];
      const { unmount } = render(<ChainReveal kq={kq} deltaVon={500} taiSan={TS} chienThuat={CT} giaiDoan={[]} suKien={[]} trait={['ky_luat']} />);
      const chu = document.body.textContent ?? '';
      expect(chu).toMatch(/KIÊN NHẪN — BTC giữ liền 3 vòng, cộng thêm 10% phần lãi/);
      expect(chu).toMatch(/NÓNG VỘI — BTC giữ liền 4 vòng, cắt 25% phần lãi/);
      expect(chu).toMatch(/KỶ LUẬT đỡ đòn/);
      expect(chu).toMatch(/KỶ LUẬT — phí bảo hiểm mỗi vòng/);
      expect(chu).toMatch(/dư âm tin bị che/);
      expect(chu).not.toMatch(/chưa có nhãn/);
      unmount();
      render(<ChainReveal kq={kq} deltaVon={500} taiSan={TS} chienThuat={CT} giaiDoan={[]} suKien={[]} />);
      const chu2 = document.body.textContent ?? '';
      expect(chu2).toMatch(/Chặn Lỗ đỡ đòn/);
      expect(chu2).not.toMatch(/KỶ LUẬT đỡ đòn/);
    });
  });
});

describe('§VI bản đồ + dải đối thủ', () => {
  const GD: NhanDTO[] = [{ id: 'tang', label: 'Đang lên', icon: '📈' }, { id: 'di_ngang', label: 'Đứng im', icon: '➖' }];
  const SK: NhanDTO[] = [{ id: 'ha_lai_suat', label: 'Hạ lãi suất', icon: '📉' }];
  const oGD = (gd: string): ODTO => ({ kind: 'giai_doan', giai_doan: gd } as ODTO);
  const oSK = (): ODTO => ({ kind: 'su_kien', su_kien: 'ha_lai_suat', bao_truoc: 'tang', tinh_chat: 'van_tien' } as ODTO);
  const ve = (them: Partial<React.ComponentProps<typeof MarketMap>> = {}) => render(<MarketMap
    daLat={[oGD('tang'), oSK(), oGD('tang'), oGD('di_ngang')]} hienTai={null} vong={5} tongVong={8} conLai={4} art={{}}
    giaiDoan={GD} suKien={SK} telegraph={{ tu_su_kien: 'ha_lai_suat', nghieng_ve: 'tang', keo_theo: [] }} upO {...them}
  />);

  it('SƯƠNG MÙ (D422): ô `suong` vẽ HAI mặt pha — hai hình, hai tên — và không huy hiệu/tên lá thật lẻ; ô thường vẽ một mặt (vế ngược)', () => {
    const art = { gd_tang: '<svg data-a="tang"></svg>', gd_di_ngang: '<svg data-a="di_ngang"></svg>' };
    const { container, unmount } = ve({ art, daLat: [oGD('tang'), oSK(), { kind: 'suong', hai_mat: ['di_ngang', 'tang'] } as ODTO] });
    const o = container.querySelector('[data-o-suong]')!;
    expect(o).not.toBeNull();
    expect(o.getAttribute('data-o-suong')).toBe('di_ngang tang');
    expect([...o.querySelectorAll('svg[data-a]')].map((x) => x.getAttribute('data-a'))).toEqual(['di_ngang', 'tang']);
    expect(o.textContent).toMatch(/\//);
    unmount();
    expect(ve({ art }).container.querySelector('[data-o-suong]')).toBeNull();
  });

  it('MÙ TIN (D422): ô `che` vẽ lá che — hình MÙ TIN, "TIN BỊ CHE", không huy hiệu tính chất; ô tin thường vẫn có huy hiệu (vế ngược)', () => {
    const { container, unmount } = ve({ daLat: [oGD('tang'), oSK(), oGD('tang'), { kind: 'che' } as ODTO] });
    const o = container.querySelector('[data-o-che]')!;
    expect(o).not.toBeNull();
    expect(o.textContent).toContain('TIN BỊ CHE');
    expect(o.querySelector('svg path'), 'lá che vẽ hình MÙ TIN').not.toBeNull();
    expect(o.querySelector('[data-tinh-chat]')).toBeNull();
    unmount();
    const { container: c2 } = ve();
    expect(c2.querySelector('[data-o-che]')).toBeNull();
    expect(c2.querySelector('[data-tinh-chat]')).not.toBeNull();
    expect(c2.querySelector('[data-nghieng]')).not.toBeNull();
  });

  it('NỘI GIÁN: ô úp in LOẠI lá kế (TIN/PHA), vắng ⇒ dấu hỏi', () => {
    const { container, unmount } = ve({ loaiLaKe: ['tin', 'pha'] });
    const loai = [...container.querySelectorAll('[data-loai-ke]')].map((e) => e.textContent);
    expect(loai).toEqual(['TIN', 'PHA']);
    unmount();
    const { container: c2 } = ve();
    expect(c2.querySelector('[data-loai-ke]')).toBeNull();
    expect(c2.textContent).toContain('?');
  });

  it('D588 — REEL (lật kiểu slot) đã BỎ: ô vừa lật chỉ có lá thật, không lớp mồi; CSS không còn lớp reel (founder 11/10)', () => {
    const { container } = ve();
    const nay = container.querySelector('[data-o-dang-lat]');
    expect(nay, 'phải có ô vừa lật — không thì bài không canh gì').not.toBeNull();
    expect(container.querySelector('[data-reel]')).toBeNull();
    const tsx = readFileSync(resolve(process.cwd(), 'src/components/holdem/MarketMap.tsx'), 'utf8');
    expect(tsx, 'không còn nhánh vẽ lớp mồi').not.toMatch(/data-reel|reelMat|matMoi/);
    const css = readFileSync(resolve(process.cwd(), 'src/components/holdem/MarketMap.module.css'), 'utf8');
    expect(css).not.toMatch(/\.reel|@keyframes reel/);
  });

  it('dải đối thủ: ghế có `lua_nac` > 0 mang ngọn lửa; 0 hay vắng ⇒ không', () => {
    const ghe = (id: string, patch: Partial<DoiThuDTO> = {}): DoiThuDTO => ({
      ghe_id: id, loai: 'bot', ten: `Máy · ${id}`, bac_rank: '—', con_song: true, so_the: 3, fx: 'binh_thuong', ...patch,
    } as DoiThuDTO);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DoiThuStrip doiThu={[ghe('a', { lua_nac: 2 }), ghe('b', { lua_nac: 0 }), ghe('c')]} vongTruoc={new Map<string, KetQuaGheDTO>()} />
      </QueryClientProvider>,
    );
    const co = [...container.querySelectorAll('[data-lua-nac]')].map((e) => e.getAttribute('data-lua-nac'));
    expect(co).toEqual(['2']);
    expect(container.querySelector('[data-ghe="a"] [data-tap="lua"]')?.getAttribute('data-nac')).toBe('2');
  });
});

describe('§VIII ví gộp XU (D411)', () => {
  it('nhãn: trận gộp là XU, trận cũ giữ VÀNG', () => {
    expect(nhanVi({ luot_khao_sat: 3, xu: 3, xu_gop: true })).toBe('XU');
    expect(nhanVi({ luot_khao_sat: 3 })).toBe('VÀNG');
  });
  it('ví gộp: đổi bài và chợ trait cùng trừ phần đã cuộn; trận cũ: VÀNG nguyên, chợ đọc xu riêng', () => {
    const gop = { luot_khao_sat: 7, xu: 9, xu_gop: true };
    // Trận gộp đọc `luot_khao_sat` (server đã trừ đổi bài vào đó), KHÔNG đọc `xu` (chưa trừ) — đúng số 7, không phải 9.
    expect(viConLai(gop, 0)).toBe(7);
    expect(viConLai(gop, 5)).toBe(2);
    expect(viDoiBai(gop, 5)).toBe(2);
    expect(viConLai(gop, 99), 'không âm').toBe(0);
    const cu = { luot_khao_sat: 4, xu: 6 };
    expect(viDoiBai(cu, 5), 'trận cũ: cuộn chợ không đụng VÀNG').toBe(4);
    expect(viConLai(cu, 2)).toBe(4);
  });
  it('nút cuộn chợ nhận ví CÒN LẠI: đã cuộn hết ví thì lần kế khoá dù giá bước kế nhỏ hơn ví ban đầu', () => {
    // Ví 5, đã cuộn 1 lần (2 xu) ⇒ còn 3; lần kế giá 3 ⇒ vẫn cuộn được. Đã cuộn 2 lần (5 xu) ⇒ còn 0 ⇒ khoá.
    const goc = { giaCuon: CHO_TRAIT.GIA_CUON_XU, cuonToiDa: CHO_TRAIT.CUON_TOI_DA, onCuon: () => {} };
    const gop = { luot_khao_sat: 5, xu: 5, xu_gop: true };
    const tongDaTra = (k: number) => CHO_TRAIT.GIA_CUON_XU.slice(0, k).reduce((a, b) => a + b, 0);
    const { container, rerender } = render(<NutCuonTrait {...goc} lanCuon={1} xu={viConLai(gop, tongDaTra(1))} />);
    expect((container.querySelector('[data-tap="cuon-trait"]') as HTMLButtonElement).disabled).toBe(false);
    rerender(<NutCuonTrait {...goc} lanCuon={2} xu={viConLai(gop, tongDaTra(2))} />);
    expect((container.querySelector('[data-tap="cuon-trait"]') as HTMLButtonElement).disabled, 'hết ví mà vẫn cho cuộn').toBe(true);
  });
});

describe('§VII chữ lỗi lệnh + công của lá', () => {
  it('gong_cum nói trần BÁN theo config; so_mong có câu; `song` là công của Lướt Sóng, `lua` không thuộc lá nào', () => {
    expect(chuLoiLenh('gong_cum')).toMatch(/GÔNG CÙM.*bán.*40%/);
    expect(chuLoiLenh('so_mong')).toMatch(/SỔ MỎNG/);
    expect(laCuaMatXich({ kind: 'song', ma: 'btc', nguong_bp: 500, dinh_bp: 600, phan_bp: 5000, delta_bp: 10 })).toBe('luot_song');
    expect(laCuaMatXich({ kind: 'lua', ma: 'btc', nac: 1, thuan: true, he_so_bp: 300, delta_bp: 5 })).toBeNull();
  });

  it('D425 — màn trận đưa phí cố định + phần BÁN còn được của `rang_buoc` xuống bản nháp shop (thiếu thì dòng đỏ im, tiền về báo sai)', () => {
    // Quét mã nguồn (nếp `alpha_draft_hoi_quy`): dựng cả màn trận trong jsdom chỉ để đọc hai prop là quá đắt.
    const src = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(src).toMatch(/phiCoDinhLenh:\s*b\.rang_buoc\.phi_co_dinh_lenh/);
    expect(src).toMatch(/tranBanCon:\s*b\.rang_buoc\.tran_ban_con/);
    const shop = readFileSync(resolve(process.cwd(), 'src/components/holdem/ShopManHinh.tsx'), 'utf8');
    // D533 — mandate · chuỗi lỗi · kiểm-trước-khi-xếp gom về MỘT hàm `lyDoCuaChuoi` ⇒ hai lời gọi bản nháp (xem trước · `lyDoCuaChuoi`), và cả
    // ba nơi hỏi lý do bị bác đều đi qua hàm ấy — vẫn đúng ý bài: không bản nháp nào thiếu tham số trait.
    expect([...shop.matchAll(/traitLenhCua\(nav\)/g)].length, 'hai lời gọi bản nháp (xem trước · lyDoCuaChuoi)').toBe(2);
    expect([...shop.matchAll(/lyDoCuaChuoi\((?:nav\.lenh|themLenhMoc)/g)].length, 'mandate · chuỗi lỗi · kiểm trước khi xếp').toBe(3);
  });

  it('D430 — CHỐT trong shop khi trait lệch cân: màn trận KIỂM TRƯỚC khi đóng shop và trả false (shop nhả khoá chốt)', () => {
    // Quét mã nguồn: đóng shop rồi mới chặn là cú chặn mở lại shop trong CÙNG nhịp ⇒ shop không gỡ, khoá chốt kẹt.
    const src = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(src).toMatch(/if \(traitLechCan\(\)\) \{ chanTraitLech\(\); return false; \}\s*shopMoLucLat\.current = true;\s*setShopMo\(false\);/);
  });
});
