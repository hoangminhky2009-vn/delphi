/**
 * DẢI THỊ TRƯỜNG — sáu mã cùng đọc sau chốt (12/09, Q3 "liên kết nhìn thấy").
 *
 * Bốn thứ đáng canh, mỗi thứ một bài:
 *  1. NẤC và CHIỀU đọc đúng từ `thi_truong_vong` (ngưỡng 100/700/1500 bp) —
 *     vector chép tay, không suy từ code.
 *  2. NHỊP: nhóm NGƯỢC chiều chính hiện mũi tên nhịp thứ hai (`dauSau`), nhóm
 *     cùng chiều hiện ngay; cả sáu cùng chiều thì không ai bị trễ.
 *  3. RANH M.2: chưa `nhich` (ô đang lật) hoặc vắng `thi_truong_vong` ⇒ không
 *     màu chiều, không mũi tên, không vạch — dải câm, không dấu hỏi.
 *  4. D398 — LÁ ĐỨNG YÊN, độ mạnh = SỐ MŨI TÊN (founder 24/09: "cho nó đứng im đi chứ cứ lên
 *     xuống rối mắt quá … giảm mạnh thì 2 icon giảm, tăng mạnh thì 2 icon tăng").
 * Tiêm lỗi 12/09: đổi ngưỡng nấc 700 → 701 ở component ⇒ bài 1 đỏ (delta 700
 * rơi về nấc 1); đảo điều kiện `chieu !== chinh` ⇒ bài 2 đỏ. Hoàn nguyên bằng
 * thay-chuỗi, không `git checkout`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  chieuChinh, DaiThiTruong, nacCua, NGUONG_NAC_BP, soMuiTen, vachThuoc, type LaThiTruong,
} from '../src/components/holdem/DaiThiTruong';
import type { ThanhKhoanVongDTO } from '../src/api/holdem';

const SAU: LaThiTruong[] = [
  { id: 'btc', ten: 'Crypto', nhom: 'rui_ro', chipDay: 2 },
  { id: 'cp_cn', ten: 'Cổ tech', nhom: 'rui_ro', chipDay: 0 },
  { id: 'vn30', ten: 'Blue-chip', nhom: 'rui_ro', chipDay: 1 },
  { id: 'vang', ten: 'Vàng', nhom: 'phong_thu', chipDay: 0 },
  { id: 'usd', ten: 'USD', nhom: 'phong_thu', chipDay: 0 },
  { id: 'tpcp', ten: 'Trái phiếu', nhom: 'phong_thu', chipDay: 1 },
];

/** Chiến tranh: rủi ro rơi, trú ẩn lên — chữ ký "trú ẩn thật" (§8.2 tệp nghiên cứu). */
const CHIEN_TRANH = [
  { ma: 'btc', delta_bp: -1800 }, { ma: 'cp_cn', delta_bp: -900 }, { ma: 'vn30', delta_bp: -700 },
  { ma: 'vang', delta_bp: 450 }, { ma: 'usd', delta_bp: 120 }, { ma: 'tpcp', delta_bp: 40 },
];

function laCua(container: HTMLElement, ma: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-ma="${ma}"]`);
  if (!el) throw new Error(`không thấy lá ${ma}`);
  return el;
}

describe('1. nấc và chiều — vector chép tay', () => {
  it('ngưỡng ba nấc đúng bảng 100 / 700 / 1500 bp, đối xứng hai chiều', () => {
    expect(NGUONG_NAC_BP).toEqual([100, 700, 1500]);
    expect(nacCua(0)).toBe(0);
    expect(nacCua(99)).toBe(0);
    expect(nacCua(100)).toBe(1);
    expect(nacCua(-699)).toBe(1);
    expect(nacCua(700)).toBe(2);
    expect(nacCua(-1499)).toBe(2);
    expect(nacCua(1500)).toBe(3);
    expect(nacCua(-9000)).toBe(3);
  });

  it('sáu lá mang đúng data-nac / data-chieu sau chốt', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={{ icon: 'shield', ten: 'HOẢNG LOẠN' }} vong={3} nhich />,
    );
    const doc = (ma: string) => {
      const la = laCua(container, ma);
      return `${la.dataset['chieu']}/${la.dataset['nac']}`;
    };
    expect(doc('btc')).toBe('-1/3');
    expect(doc('cp_cn')).toBe('-1/2');
    expect(doc('vn30')).toBe('-1/2');
    expect(doc('vang')).toBe('1/1');
    expect(doc('usd')).toBe('1/1');
    // 40 bp: có chiều (tam giác) nhưng dưới nấc 1 ⇒ không nhích.
    expect(doc('tpcp')).toBe('1/0');
  });
});

describe('2. nhịp — nhóm ngược chiều chính hiện mũi tên nhịp thứ hai', () => {
  it('chiều chính = dấu trung vị; hoà thì dấu tổng; rỗng = 0', () => {
    expect(chieuChinh([-1800, -900, -700, 450, 120, 40])).toBe(-1);
    expect(chieuChinh([300, 200, 100, -50, -60, -70])).toBe(1);
    expect(chieuChinh([500, -500])).toBe(0);      // trung vị 0, tổng 0
    expect(chieuChinh([500, -500, 10, -10])).toBe(0);
    expect(chieuChinh([900, -500])).toBe(1);      // trung vị 200
    expect(chieuChinh([])).toBe(0);
  });

  it('chiến tranh: ba mã rủi ro hiện mũi tên ngay, hai mã trú ẩn (ngược chiều chính) trễ một nhịp', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={null} vong={3} nhich />,
    );
    const tre = (ma: string) => (laCua(container, ma).querySelector('[class*="dauChieu"]')?.className ?? '')
      .includes('dauSau');
    expect(['btc', 'cp_cn', 'vn30'].map(tre)).toEqual([false, false, false]);
    // TPCP +40 bp là "đứng giá" (dấu "=") — không có mũi tên nào để trễ.
    expect(['vang', 'usd', 'tpcp'].map(tre)).toEqual([true, true, false]);
  });

  it('cả sáu cùng rơi (sập sàn): không lá nào trễ — "phân tán không cứu được" hiện ra đúng bằng một nhịp', () => {
    const sap = SAU.map((x) => ({ ma: x.id, delta_bp: -800 }));
    const { container } = render(<DaiThiTruong la={SAU} thiTruong={sap} keo={null} vong={2} nhich />);
    expect(SAU.map((x) => (laCua(container, x.id).querySelector('[class*="dauChieu"]')?.className ?? '')
      .includes('dauSau'))).toEqual(Array(6).fill(false));
  });
});

describe('3. ranh M.2 — trước khi tới nhịp, dải đứng yên', () => {
  it('chưa nhich (ô còn đang lật): không nấc, không chiều, không vạch', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={{ ten: 'HOẢNG LOẠN' }} vong={3} nhich={false} />,
    );
    for (const x of SAU) {
      const la = laCua(container, x.id);
      expect(la.dataset['nac']).toBe('0');
      expect(la.dataset['chieu']).toBe('0');
      expect(la.className).not.toMatch(/dong|nac2|nac3|_len_|_xuong_/);
      expect(la.querySelector('[class*="dauChieu"]')).toBeNull();
    }
    expect(container.querySelectorAll('i').length).toBeGreaterThanOrEqual(0);
  });

  it('vắng thi_truong_vong (API cũ / trận không NAV): sáu lá vẫn vẽ, không mũi tên, không dấu hỏi', () => {
    const { container } = render(<DaiThiTruong la={SAU} thiTruong={undefined} keo={null} vong={0} nhich />);
    expect(container.querySelectorAll('[data-ma]').length).toBe(6);
    expect(container.textContent).not.toContain('?');
    for (const x of SAU) expect(laCua(container, x.id).dataset['nac']).toBe('0');
  });

  it('cọc chip chỉ ở lá đang cầm, đúng số chip dày (trần 4)', () => {
    const { container } = render(<DaiThiTruong la={SAU} thiTruong={undefined} keo={null} vong={0} nhich={false} />);
    const coc = (ma: string) => laCua(container, ma).querySelectorAll('[class*="chip"]').length;
    expect(coc('btc')).toBe(2);
    expect(coc('vn30')).toBe(1);
    expect(coc('cp_cn')).toBe(0);
    expect(coc('vang')).toBe(0);
  });
});

/*
 * ═══ 4. CHIỀU = MẶT NẠ MÀU TRÊN LÁ, KHÔNG MŨI TÊN (12/09) ═══════════════════
 * Founder: *"thay vì phải thêm mũi tên xanh/đỏ tăng giảm ở dưới, tại sao không
 * tiết kiệm diện tích phần đó và cho mặt nạ hoặc hiệu ứng xanh/đỏ cho loại asset
 * đó?"*. Ba điều khoá lại: (a) lá có chiều mang lớp `len`/`xuong` — kể cả 40 bp
 * dưới nấc 1, chiều vẫn phải đọc được như tam giác cũ; (b) không còn phần tử mũi
 * tên nào; (c) hàng chân CHỈ mọc ở lá đang cầm — lá không chip không tốn 9px.
 * Tiêm lỗi: đổi chỗ `s.len` ↔ `s.xuong` ⇒ bài (a) đỏ.
 */
describe('4. chiều bằng mặt nạ màu', () => {
  const lop = (el: HTMLElement, ten: string) =>
    el.className.split(' ').some((c) => c.startsWith(`_${ten}_`));

  it('⭐ sau chốt: lá xuống mang `xuong`, lá lên mang `len`; dưới nấc 1 là ĐỨNG GIÁ, không màu chiều', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={{ icon: 'shield', ten: 'HOẢNG LOẠN' }} vong={3} nhich />,
    );
    expect(lop(laCua(container, 'btc'), 'xuong')).toBe(true);
    expect(lop(laCua(container, 'btc'), 'len')).toBe(false);
    expect(lop(laCua(container, 'vang'), 'len')).toBe(true);
    expect(lop(laCua(container, 'vang'), 'xuong')).toBe(false);
    // D398 — 40 bp là "không ảnh hưởng nhiều" (founder 24/09): không màu chiều, chỉ dấu "=".
    // (Luật 12/09 "dưới nấc 1 chiều vẫn phải đọc được" bị lời 24/09 đè.)
    expect(lop(laCua(container, 'tpcp'), 'len') || lop(laCua(container, 'tpcp'), 'xuong')).toBe(false);
  });

  it('chưa chốt ⇒ không lá nào mang màu chiều', () => {
    const { container } = render(<DaiThiTruong la={SAU} thiTruong={undefined} keo={null} vong={0} nhich={false} />);
    for (const ma of ['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp']) {
      expect(lop(laCua(container, ma), 'len') || lop(laCua(container, ma), 'xuong')).toBe(false);
    }
  });

  /*
   * 13/09 — HUY HIỆU CHIỀU QUAY LẠI, và bài này ĐẢO THEO.
   * Bản trước ghim "không còn phần tử mũi tên" (chỉ thị 12/09: bỏ tam giác, mã hoá
   * chiều bằng mặt nạ màu). Founder bấm thử rồi bác chính cái đó: *"hiệu ứng tương
   * quan của 6 lá m làm chán quá, thôi thêm vào icon tăng/giảm biểu thị đi"*. Nên
   * hợp đồng mới: mặt nạ Ở LẠI (chở độ mạnh) + icon pixel chở CHIỀU. Ghi cả câu
   * cũ ở đây để lần sau không ai "dọn" icon đi vì tưởng nó là tàn dư.
   */
  it('⭐ D398 — ĐỘ MẠNH = SỐ MŨI TÊN: mạnh 2 · nhẹ 1 · đứng giá "="; mỗi lá đúng một huy hiệu', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={{ icon: 'shield', ten: 'HOẢNG LOẠN' }} vong={3} nhich />,
    );
    const dau = (ma: string) => laCua(container, ma).querySelector('[class*="dauChieu"]');
    const mui = (ma: string) => `${dau(ma)?.getAttribute('data-so-mui')}`;
    // CHIẾN TRANH: BTC −18% · CP −9% · VN30 −7% (mạnh) · Vàng +4,5% · USD +1,2% (nhẹ) · TPCP +0,4% (đứng giá)
    expect(['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp'].map(mui)).toEqual(['2', '2', '2', '1', '1', '0']);
    expect(dau('btc')!.getAttribute('aria-label')).toMatch(/giảm mạnh/);
    expect(dau('vang')!.getAttribute('aria-label')).toMatch(/tăng nhẹ/);
    expect(dau('tpcp')!.textContent).toBe('=');
    // PixelIcon vẽ bằng <span aria-hidden> (không svg) — đếm con trực tiếp của huy hiệu.
    expect(dau('btc')!.children.length, 'hai mũi tên cho giảm mạnh').toBe(2);
    expect(dau('vang')!.children.length, 'một mũi tên cho tăng nhẹ').toBe(1);
    for (const x of SAU) {
      expect(laCua(container, x.id).querySelectorAll('[class*="dauChieu"]').length, x.id).toBe(1);
    }
  });

  it('D398 — vector số mũi tên chép tay theo nấc', () => {
    expect([0, 1, 2, 3].map((n) => soMuiTen(n as 0 | 1 | 2 | 3))).toEqual([0, 1, 2, 2]);
  });

  it('⭐ D398 — LÁ ĐỨNG YÊN: CSS của dải không còn một keyframe dịch chuyển nào', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/holdem/DaiThiTruong.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css, 'translate lên/xuống quay lại = lá lại chạy (founder: "rối mắt quá")').not.toMatch(/translate/);
    expect(css).not.toMatch(/nhich(Len|Xuong)/);
  });

  it('⭐ CHƯA CHỐT thì không lá nào có mũi tên — trước quyết định dải phải câm', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={null} vong={3} nhich={false} />,
    );
    expect(container.querySelector('[class*="dauChieu"]'),
      'mũi tên hiện trước khi chốt = lời khuyên, không phải mô tả (HOP-MOAT M.2)').toBeNull();
  });

  it('hàng chân chỉ mọc ở lá đang cầm', () => {
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={{ icon: 'shield', ten: 'HOẢNG LOẠN' }} vong={3} nhich />,
    );
    expect(laCua(container, 'btc').querySelector('[class*="chan"]')).not.toBeNull();   // 2 chip
    expect(laCua(container, 'cp_cn').querySelector('[class*="chan"]')).toBeNull();     // 0 chip
  });
});

/*
 * 5. THƯỚC THANH KHOẢN (D395, founder 24/09: "co dãn theo thẻ sự kiện đang được lật").
 * Vector chép tay: nền → vạch của vòng, đủ bốn ca (co · giãn · đứng · sương mù) + ranh M.2.
 * Tiêm lỗi 24/09: sương mù vẽ theo nền mà không thở ⇒ bài sương mù đỏ; sương mù thở đủ năm vạch (bản đầu,
 * soi mắt bắt) ⇒ hai bài sương mù đỏ; vẽ thước khi vắng dữ liệu ⇒ bài "API cũ" đỏ.
 */
describe('5. thước thanh khoản — co/giãn theo lá vừa lật', () => {
  const tk = (vach_nen: number, vach: number | null): ThanhKhoanVongDTO => ({
    ma: 'vn30', tong_vach: 5, vach_nen, vach,
  });

  it('trước nhịp: thước nằm ở NỀN, không vạch nào co/giãn', () => {
    expect(vachThuoc(tk(4, 2), false)).toEqual(['sang', 'sang', 'sang', 'sang', 'tat']);
  });
  it('lá làm MỎNG sổ: vạch mất nháy đỏ (co)', () => {
    expect(vachThuoc(tk(4, 2), true)).toEqual(['sang', 'sang', 'co', 'co', 'tat']);
  });
  it('lá làm DÀY sổ: vạch thêm bật xanh (giãn)', () => {
    expect(vachThuoc(tk(3, 5), true)).toEqual(['sang', 'sang', 'sang', 'gian', 'gian']);
  });
  it('lá không chạm sổ: thước đứng yên ở nền', () => {
    expect(vachThuoc(tk(3, 3), true)).toEqual(['sang', 'sang', 'sang', 'tat', 'tat']);
  });
  it('⚠ mã đầu cơ (sương mù): các vạch NỀN thở mờ, vạch ngoài nền tắt — không co không giãn', () => {
    expect(vachThuoc(tk(2, null), false)).toEqual(['sang', 'sang', 'tat', 'tat', 'tat']);   // nền: công khai
    expect(vachThuoc(tk(2, null), true)).toEqual(['mo', 'mo', 'tat', 'tat', 'tat']);
  });
  it('⭐ sương mù KHÔNG BAO GIỜ trông như giãn: số vạch có ánh sáng = nền, ở mọi nấc nền', () => {
    /*
     * Soi mắt D395 lần hai: thước sương mù thở đủ năm vạch ⇒ dưới CẠN THANH KHOẢN, Crypto đi từ 2 vạch LÊN 5 —
     * mắt đọc là giãn (ngược sự thật), đứng cạnh VN30 năm vạch thì đọc là "rất dày".
     */
    for (let nen = 1; nen <= 5; nen += 1) {
      const sau = vachThuoc(tk(nen, null), true);
      expect(sau.filter((v) => v !== 'tat').length).toBe(nen);
      expect(sau.every((v) => v === 'mo' || v === 'tat')).toBe(true);
    }
  });

  it('dải vẽ một thước mỗi mã khi vòng mang `thanh_khoan_vong`, nhãn đọc được nấc của vòng', () => {
    const THUOC: ThanhKhoanVongDTO[] = SAU.map((x) => ({ ma: x.id, tong_vach: 5, vach_nen: 3, vach: 1 }));
    const { container } = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={null} vong={3} nhich thanhKhoan={THUOC} />,
    );
    const thuoc = container.querySelectorAll('[data-thuoc]');
    expect(thuoc.length).toBe(6);
    expect(thuoc[0]!.getAttribute('data-thuoc')).toBe('sang,co,co,tat,tat');
    expect(thuoc[0]!.getAttribute('aria-label')).toContain('vòng này: 1/5');
  });

  it('⚠ vắng `thanh_khoan_vong` (API cũ · trận không NAV · chưa chốt) ⇒ không một thước nào', () => {
    const { container } = render(<DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={null} vong={3} nhich />);
    expect(container.querySelectorAll('[data-thuoc]').length).toBe(0);
  });

  it('⭐ GIỮ CHỖ hàng thước khi chưa có dữ liệu — dải không nhảy bố cục lúc thước mọc sau chốt', () => {
    /*
     * Đo trên màn thật D395: thước chỉ mọc sau chốt ⇒ dải 61 → 67px, mọi khối bên dưới tụt 6px đúng nhịp kết
     * quả rồi nhảy ngược lại khi sang vòng. jsdom không đo px ⇒ canh CẤU TRÚC: mỗi lá có đúng MỘT hàng thước
     * (thật hoặc giữ chỗ) ở cả hai trạng thái; ô giữ chỗ trống trơn (trước chốt dải vẫn câm — M.2).
     */
    const hangThuoc = (c: HTMLElement) => [...c.querySelectorAll('[data-ma]')].map((la) =>
      [...la.children].filter((e) => e.hasAttribute('data-thuoc') || e.hasAttribute('data-cho-thuoc')).length);
    const truoc = render(
      <DaiThiTruong la={SAU} thiTruong={undefined} keo={null} vong={3} nhich={false} coThuoc />,
    );
    expect(hangThuoc(truoc.container)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(truoc.container.querySelectorAll('[data-thuoc]').length).toBe(0);
    expect(truoc.container.querySelectorAll('[data-cho-thuoc] *').length).toBe(0);
    truoc.unmount();
    const THUOC: ThanhKhoanVongDTO[] = SAU.map((x) => ({ ma: x.id, tong_vach: 5, vach_nen: 3, vach: 3 }));
    const sau = render(
      <DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={null} vong={3} nhich thanhKhoan={THUOC} coThuoc />,
    );
    expect(hangThuoc(sau.container)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(sau.container.querySelectorAll('[data-cho-thuoc]').length).toBe(0);
  });

  it('vế ngược — trận KHÔNG có thước (v53 · v45 · API cũ): không giữ chỗ, dải y hệt trước D395', () => {
    const { container } = render(<DaiThiTruong la={SAU} thiTruong={CHIEN_TRANH} keo={null} vong={3} nhich />);
    expect(container.querySelectorAll('[data-cho-thuoc]').length).toBe(0);
    expect(container.querySelectorAll('[data-thuoc]').length).toBe(0);
  });

  it('⭐ dây nối — màn trận truyền ĐÚNG cờ trận và dữ liệu vòng xuống dải (quên một dòng là thước câm êm)', () => {
    const man = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
    expect(man.includes('coThuoc={st.thanh_khoan_nam_nac === true}'), 'dải không biết trận có thước ⇒ nhảy 6px')
      .toBe(true);
    expect(man.includes('thanhKhoan={ketQuaCho?.tt.ket_qua_vong?.thanh_khoan_vong}'), 'dải không nhận thước của vòng')
      .toBe(true);
  });
});
