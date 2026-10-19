/**
 * MẶT LÁ BÀI TRÊN APP = ĐÚNG TRANG ĐÃ DUYỆT (D390 → D393).
 *
 * Art (lưới) do server cấp và `tests/holdem_art.test.ts` §5 so từng ô với trang demo. Tệp này
 * canh nửa còn lại — thứ client vẽ quanh art: tên · nhóm · mã góc phải · họ màu · icon loại
 * thiên nga đen · nhịp vệt sáng. Chép tay mà không canh là bản sao thứ hai sẽ trôi (D61).
 *
 * ⭐ Và canh cái founder dặn riêng: *"chú ý logic phần hiển thị của thẻ thiên nga đen"* —
 * bảy tin hoảng loạn là MỘT lá, loại tin chỉ là icon góc phải.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SU_KIEN, TINH_CHAT_NEN } from '@config/holdem';
import { LA_BAI } from '../../server/art/la_bai';
import { NHIP_VET } from '../../server/holdem_art_la';
import type { NhanDTO, ODTO } from '../src/api/holdem';
import { MarketMap } from '../src/components/holdem/MarketMap';
import { HO_MAU, KHOA_MAT, LOAI_THIEN_NGA, matLa, type HoLa } from '../src/lib/la_bai';

const DEMO = readFileSync(resolve(process.cwd(), '../docs/ui-ux/demo/la-bai-phong-cach.html'), 'utf8');
const CSS = readFileSync(resolve(process.cwd(), 'src/components/holdem/MarketMap.module.css'), 'utf8');

/** Một lá trong mảng `THE` của demo: `{ id: '…', …, nhom: '…', ma: '…', ten: '…', ho: '…', … }`. */
function laDemo(id: string) {
  const m = new RegExp(`\\{ id: '${id}',([^{}]*?)goc: -?\\d+ \\}`).exec(DEMO);
  expect(m, `trang demo không có lá "${id}"`).toBeTruthy();
  const tra = (ten: string) => new RegExp(`\\b${ten}: '([^']*)'`).exec(m![1]!)?.[1];
  return { nhom: tra('nhom'), ma: tra('ma'), ten: tra('ten'), ho: tra('ho') };
}

describe('I. Mặt lá = lá của trang demo', () => {
  it('bài không rỗng: đủ 22 lá có mặt, khớp đúng bộ lá server vẽ', () => {
    expect([...KHOA_MAT].sort()).toEqual(Object.keys(LA_BAI).sort());
  });

  for (const [khoa, la] of Object.entries(LA_BAI)) {
    it(`"${khoa}" — tên · nhóm · mã · họ đúng lá "${la.demo}"`, () => {
      const d = laDemo(la.demo);
      const m = matLa(khoa)!;
      // U+FE0E chỉ ép ký tự vẽ dạng chữ (♨ của Quá nóng) — cùng ký tự với demo, bỏ khi so.
      const ma = m.ma.replace(/︎/g, '');
      expect({ nhom: m.nhom, ma, ten: m.ten, ho: m.ho }).toEqual(d);
    });
  }

  it('bảy họ màu chép nguyên hex của demo', () => {
    for (const [ho, { mau, sang }] of Object.entries(HO_MAU) as [HoLa, { mau: string; sang: string }][]) {
      const m = new RegExp(`\\.${ho}\\{--ho:(#[0-9a-f]{6});--ho-sang:(#[0-9a-f]{6})\\}`).exec(DEMO);
      expect(m, `demo không khai họ "${ho}"`).toBeTruthy();
      expect([mau, sang], `họ "${ho}" lệch demo`).toEqual([m![1], m![2]]);
    }
  });
});

describe('II. ⭐⭐ Thiên nga đen — bảy tin, MỘT lá, loại tin là icon góc phải', () => {
  const hoangLoan = SU_KIEN.filter((x) => TINH_CHAT_NEN[x.id] === 'hoang_loan').map((x) => x.id as string);

  it('mọi tin hoảng loạn mang CÙNG mặt thiên nga; không tin nào khác mượn nó', () => {
    expect(hoangLoan.length).toBeGreaterThanOrEqual(7);
    for (const x of SU_KIEN) {
      const m = matLa(`sk_${x.id}`)!;
      if (hoangLoan.includes(x.id)) {
        expect([m.ten, m.ho, m.nhom], x.id).toEqual(['THIÊN NGA ĐEN', 'hoang', 'HOẢNG LOẠN']);
      } else {
        expect(m.ten, `"${x.id}" không hoảng loạn mà hiện thành thiên nga`).not.toBe('THIÊN NGA ĐEN');
      }
    }
  });

  it('sáu loại có icon riêng — chép nguyên lưới + tên của demo', () => {
    const icon = JSON.parse(/const ICON = (\{.*?\});\r?\n/.exec(DEMO)![1]!) as Record<string, string[]>;
    expect(Object.keys(LOAI_THIEN_NGA).sort()).toEqual(Object.keys(icon).sort());
    for (const [id, loai] of Object.entries(LOAI_THIEN_NGA)) {
      expect([...loai.icon], `icon "${id}" lệch demo`).toEqual(icon[id]);
      expect(DEMO, `tên loại "${id}" lệch demo`).toContain(`{ id: '${id}', ten: '${loai.ten}' }`);
      expect(hoangLoan, `"${id}" có icon thiên nga mà engine không coi là hoảng loạn`).toContain(id);
    }
  });

  it('thiên nga đen GỐC (chưa chia loại) vẫn là lá thiên nga, chỉ không có icon loại', () => {
    const m = matLa('sk_thien_nga_den')!;
    expect(m.ten).toBe('THIÊN NGA ĐEN');
    expect(m.loai).toBeUndefined();
  });

  const CAT_SK: NhanDTO[] = SU_KIEN.map((x) => ({ id: x.id, label: x.label, icon: x.icon }));
  const ve = (su_kien: string) => render(<MarketMap
    daLat={[]} hienTai={{ kind: 'su_kien', su_kien, bao_truoc: 'giam', tinh_chat: 'hoang_loan' } as ODTO}
    vong={2} tongVong={8} conLai={6} art={{}} giaiDoan={[]} suKien={CAT_SK} telegraph={null}
  />);

  it('ô bản đồ: tên THIÊN NGA ĐEN + icon đúng loại ở góc phải, tên loại ở aria/tooltip', () => {
    for (const id of Object.keys(LOAI_THIEN_NGA)) {
      const { container, unmount } = ve(id);
      const o = container.querySelector('[data-o-dang-lat]')!;
      expect(o.textContent, id).toContain('THIÊN NGA ĐEN');
      const loai = o.querySelector('[data-loai]');
      expect(loai?.getAttribute('data-loai'), `ô "${id}" mang icon loại khác`).toBe(id);
      expect(loai?.getAttribute('title')).toBe(LOAI_THIEN_NGA[id]!.ten);
      expect(loai?.getAttribute('aria-label')).toContain(LOAI_THIEN_NGA[id]!.ten.toLowerCase());
      // Tên catalog riêng của tin (vd "Chiến tranh") KHÔNG thay tên lá — đó là việc của icon.
      expect(o.querySelector('[class*="ten"]')?.textContent).toBe('THIÊN NGA ĐEN');
      unmount();
    }
  });

  it('ô tin thường: mã lá ở góc phải, không icon loại', () => {
    const { container } = ve('ha_lai_suat');
    const o = container.querySelector('[data-o-dang-lat]')!;
    expect(o.querySelector('[data-loai]')).toBeNull();
    expect(o.textContent).toContain('%↓');
    expect(o.textContent).toContain('HẠ LÃI SUẤT');
  });
});

describe('III. Nhịp vệt sáng của CSS = nhịp server dựng pha cho từng dải', () => {
  // Server tính `--p` của mỗi dải theo cửa sổ `NHIP_VET.*.cuaSo`; keyframe phải tắt ĐÚNG ở đó,
  // lệch là vệt bừng sai chỗ — không lỗi, không test nào khác đỏ.
  const tatO = (ten: string) => {
    const k = new RegExp(`@keyframes ${ten} \\{([\\s\\S]*?)\\n\\}`).exec(CSS)?.[1] ?? '';
    expect(k, `không thấy @keyframes ${ten}`).not.toBe('');
    return Number(/([\d.]+)%,\s*100% \{ opacity: 0; \}/.exec(k)?.[1]);
  };
  it('laVet tắt ở cửa sổ nhịp thường, laVetKim ở cửa sổ nhịp kim', () => {
    expect(tatO('laVet')).toBeCloseTo(NHIP_VET.thuong.cuaSo * 100, 3);
    expect(tatO('laVetKim')).toBeCloseTo(NHIP_VET.kim.cuaSo * 100, 3);
  });
});
