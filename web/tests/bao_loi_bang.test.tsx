/**
 * BẢNG ✉ BÁO LỖI + CHỮ ĐIỀU KHOẢN (SPEC `docs/spec/bao-loi-nguoi-choi.md` mục 5 + 7 — cửa một chiều, A11.17).
 *
 *   · CHỮ = SPEC: T1–T8 nằm NGUYÊN VĂN trong `dieuKhoan.ts`, T9 ở thẻ, T10 ở bảng — đọc thẳng từ SPEC, không chép lại vào bài.
 *     Ai sửa một chữ trong app mà không qua founder (sửa SPEC) ⇒ đỏ.
 *   · DÒNG "GỬI KÈM" ↔ GÓI GỬI: cùng dựng từ `TRUONG_GUI_KEM` + `giaTriGuiKem()` (A11.5) — thứ người chơi đọc là thứ đi.
 *   · Hết lượt (429) ⇒ chữ T10 "hết lượt", ô GIỮ nội dung; gửi xong ⇒ chữ T10 "đã gửi".
 *   · "Màn" = màn ngay TRƯỚC Hồ sơ (T5), không phải màn đang đứng.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { TRUONG_GUI_KEM } from '@config/bao_loi';
import { BAN_PHAT_HANH } from '@config/phien_ban';
import { MUC, QUYEN, TOM_TAT } from '../src/content/dieuKhoan';
import { CHU_BAO_LOI, CHU_THE_DIEU_KHOAN } from '../src/content/baoLoi';
import { TamBaoLoi, dongGuiKem } from '../src/components/BaoLoi';
import { giaTriGuiKem } from '../src/api/du_lieu';
import { _datLaiChoTest, manVuaRoi, useDoMan } from '../src/lib/telemetry';
import { ghiLoiGanNhat } from '../src/lib/loi_gan_nhat';

const SPEC = fs.readFileSync(path.resolve(process.cwd(), '../docs/spec/bao-loi-nguoi-choi.md'), 'utf8').replace(/\r\n/g, '\n');
/** Khối trích `> …` ngay dưới tiêu đề `**Tn —` của mục 7. */
function khoiT(ten: string): string[] {
  const m = new RegExp(`^\\*\\*${ten} —[^\\n]*\\n((?:> [^\\n]*\\n?)+)`, 'm').exec(SPEC);
  if (!m) throw new Error(`SPEC thiếu ${ten}`);
  return m[1]!.trim().split('\n').map((l) => l.slice(2));
}

describe('chữ trong app = chữ SPEC mục 7 (founder duyệt nguyên văn)', () => {
  const toanVan = [...TOM_TAT, ...MUC.flatMap((m) => [...m.doan, m.nhan ?? '']), ...QUYEN.map((q) => q.chu)].join('\n');

  it.each(['T1', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'])('%s nằm nguyên văn trong dieuKhoan.ts', (t) => {
    expect(toanVan).toContain(khoiT(t)[0]);
  });

  it('T2 (câu thay trong mục khách) nằm nguyên văn', () => {
    expect(toanVan).toContain(khoiT('T2')[0]);
  });

  it('T9 — thẻ báo trước: tiêu đề + thân', () => {
    const [tieuDe, than] = khoiT('T9');
    expect(tieuDe).toBe(`**${CHU_THE_DIEU_KHOAN.tieuDe} · <ngày>**`);
    expect(than).toBe(CHU_THE_DIEU_KHOAN.than);
  });

  it('T10 — bảng Báo lỗi: nhãn ô · gợi ý · nhãn email · dòng kèm · dòng cuối · gửi xong · hết lượt', () => {
    const t10 = khoiT('T10').join('\n');
    expect(t10).toContain(`nhãn ô: **${CHU_BAO_LOI.nhanO}** · gợi ý trong ô: *${CHU_BAO_LOI.goiY}*`);
    expect(t10).toContain(`nhãn email: **${CHU_BAO_LOI.nhanEmail}**`);
    expect(t10).toContain(`dòng kèm: **${CHU_BAO_LOI.guiKem}** bản <x> · màn <y> · mã lỗi <z | ${CHU_BAO_LOI.khongCo}> · mã tài khoản`);
    expect(t10).toContain(`dòng cuối: ${CHU_BAO_LOI.dongCuoi}`);
    expect(t10).toContain(`gửi xong: **${CHU_BAO_LOI.daGuiDam}** ${CHU_BAO_LOI.daGuiThan}`);
    expect(t10).toContain(`hết lượt: ${CHU_BAO_LOI.hetLuot}`);
  });
});

describe('bảng ✉ BÁO LỖI', () => {
  let fetchGia: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    _datLaiChoTest();
    fetchGia = vi.fn(async () => new Response(JSON.stringify({ ok: true, bao_loi_id: 7 }), {
      status: 201, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchGia);
  });
  afterEach(() => {
    _datLaiChoTest();
    vi.unstubAllGlobals();
  });

  const MoMan = ({ duong }: { duong: string }): null => { useDoMan(duong); return null; };
  const goiBaoLoi = () => fetchGia.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/bao-loi'));
  const go = (o: string, v: string) => fireEvent.change(document.querySelector(`[data-o=${o}]`)!, { target: { value: v } });

  it('"màn" gửi kèm = màn ngay TRƯỚC Hồ sơ (mẫu route), không phải Hồ sơ', () => {
    const { rerender } = render(<MoMan duong="/arena" />);
    rerender(<MoMan duong="/ho-so" />);
    expect(manVuaRoi()).toBe('/arena');
    expect(giaTriGuiKem().man).toBe('/arena');
  });

  it('⭐ dòng "Gửi kèm" và gói gửi cùng một nguồn: mỗi trường TRUONG_GUI_KEM có ở cả hai, theo đúng thứ tự', async () => {
    ghiLoiGanNhat('route:typeerror:1f3kq2');
    render(<TamBaoLoi mo onDong={() => {}} />);
    const dong = document.querySelector('[data-dong=gui-kem]')!.textContent!;
    // Vẽ từ hằng: đúng thứ tự, đúng giá trị.
    expect(dong).toBe(`${CHU_BAO_LOI.guiKem} ${dongGuiKem(giaTriGuiKem()).join(' · ')}`);
    let viTri = -1;
    for (const k of TRUONG_GUI_KEM) {
      const i = dong.indexOf(CHU_BAO_LOI.kem[k]);
      expect(i, `dòng Gửi kèm thiếu "${CHU_BAO_LOI.kem[k]}"`).toBeGreaterThan(viTri);
      viTri = i;
    }
    expect(dong).toContain(`bản ${BAN_PHAT_HANH}`);
    expect(dong).toContain('mã lỗi route:typeerror:1f3kq2');

    go('noi-dung-bao-loi', 'bấm CHỐT xong bàn đứng im');
    go('email-bao-loi', 'a@vidu.test');
    await act(async () => { fireEvent.click(document.querySelector('[data-nut=gui-bao-loi]')!); });
    await waitFor(() => expect(goiBaoLoi()).toHaveLength(1));
    const than = JSON.parse(String((goiBaoLoi()[0]! as [string, RequestInit])[1].body)) as Record<string, unknown>;
    // Gói = chữ + email + đúng TRUONG_GUI_KEM (trừ tai_khoan — máy chủ lấy từ phiên). Không trường nào khác.
    expect(Object.keys(than).sort()).toEqual(
      ['noi_dung', 'email', ...TRUONG_GUI_KEM.filter((k) => k !== 'tai_khoan')].sort());
    expect(than).toMatchObject({ noi_dung: 'bấm CHỐT xong bàn đứng im', email: 'a@vidu.test', ban: BAN_PHAT_HANH, ma_loi: 'route:typeerror:1f3kq2' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(`${CHU_BAO_LOI.daGuiDam} ${CHU_BAO_LOI.daGuiThan}`));
  });

  it('không điền email ⇒ gói không có trường email', async () => {
    render(<TamBaoLoi mo onDong={() => {}} />);
    go('noi-dung-bao-loi', 'lỗi');
    await act(async () => { fireEvent.click(document.querySelector('[data-nut=gui-bao-loi]')!); });
    await waitFor(() => expect(goiBaoLoi()).toHaveLength(1));
    const than = JSON.parse(String((goiBaoLoi()[0]! as [string, RequestInit])[1].body)) as Record<string, unknown>;
    expect('email' in than).toBe(false);
  });

  it('⭐ lượt thứ tư (429) ⇒ chữ "hết lượt" của T10, ô GIỮ nguyên nội dung', async () => {
    fetchGia.mockImplementation(async () => new Response(JSON.stringify({ error: 'rate_limited', message: 'x' }), {
      status: 429, headers: { 'content-type': 'application/json' },
    }));
    render(<TamBaoLoi mo onDong={() => {}} />);
    go('noi-dung-bao-loi', 'chữ đang dở');
    await act(async () => { fireEvent.click(document.querySelector('[data-nut=gui-bao-loi]')!); });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(CHU_BAO_LOI.hetLuot));
    expect((document.querySelector('[data-o=noi-dung-bao-loi]') as HTMLTextAreaElement).value).toBe('chữ đang dở');
  });
});
