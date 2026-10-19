import { describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { XuongDan } from '../src/components/XuongDan';
import { docDienMao, vietDienMao, NHAN_DAN, O_LUOI } from '@config/avatar';

/*
 * BẢN XEM TRƯỚC PHẢI LÀ BẢN SẼ DÁN.
 *
 * ⚠⚠ Founder 12/08: *"m cho mỗi một cái chấm đó thì t nhìn kiểu gì? Phải cho t
 * thấy rõ nó trông như nào trước khi chốt chứ?"* — bản cũ chỉ vẽ một ô vuông
 * đánh dấu, còn kho nhãn chỉ hiện TÊN CHỮ. Người chơi chọn một thứ không nhìn
 * thấy, đặt vào một ô trống, rồi chốt VĨNH VIỄN (D36).
 *
 * Chú thích cũ biện minh: *"bản ghép nháp sai là lời hứa sai trên một thao tác
 * không thu hồi được"*. Lo ngại đúng, kết luận ngược — nên bài này khoá đúng
 * cái làm cho lo ngại đó biến mất: **bản xem trước dựng bằng CHÍNH bộ mã hoá mà
 * server dùng**, nên nó không thể trôi khỏi bản thật (D61 · nếp D67).
 *
 * Bài khoá TÍNH CHẤT, không khoá một chuỗi cụ thể: đổi cách mã hoá kiểu gì thì
 * "đọc lại ra đúng thứ đã ghép" vẫn phải đúng.
 */

const MON = NHAN_DAN[0]!.id;
const MON2 = (NHAN_DAN[1] ?? NHAN_DAN[0])!.id;

/** Đúng phép ghép mà `XuongDan` dùng để dựng bản xem trước. */
function ghep(nen: string, mon: string, x: number, y: number, lat: boolean): string {
  const dm = docDienMao(nen);
  return vietDienMao({
    goc: dm.goc,
    bang_mau: dm.bang_mau,
    khung: dm.khung?.id ?? null,
    dan: [
      ...dm.dan.map((d) => ({ mon: d.mon.id, x: d.x, y: d.y, lat: d.lat })),
      { mon, x, y, lat },
    ],
  });
}

const NEN = vietDienMao({ goc: 'A', dan: [] });

describe('xưởng dán — bản xem trước là bản thật', () => {
  it('⭐ ghép xong đọc lại ra ĐÚNG nhãn, ĐÚNG toạ độ', () => {
    const thu = ghep(NEN, MON, 7, 21, false);
    const dm = docDienMao(thu);
    expect(dm.dan).toHaveLength(1);
    expect(dm.dan[0]!.mon.id).toBe(MON);
    expect(dm.dan[0]!.x).toBe(7);
    expect(dm.dan[0]!.y).toBe(21);
  });

  it('⭐ bản xem trước KHÁC nền — nếu bằng nhau thì người chơi vẫn đang nhìn mù', () => {
    expect(ghep(NEN, MON, 7, 21, false)).not.toBe(NEN);
  });

  it('GIỮ nhãn đã dán trước đó, chỉ THÊM một cái', () => {
    const mot = ghep(NEN, MON, 3, 3, false);
    const hai = ghep(mot, MON2, 28, 5, false);
    const dm = docDienMao(hai);
    expect(dm.dan).toHaveLength(2);
    expect(dm.dan[0]).toMatchObject({ x: 3, y: 3 });
    expect(dm.dan[1]).toMatchObject({ x: 28, y: 5 });
    expect(dm.dan[0]!.mon.id, 'nhãn cũ bị đổi mất').toBe(MON);
  });

  it('LẬT NGANG đi vào chuỗi (đặc quyền có sẵn mà client chưa bao giờ bấm được)', () => {
    expect(docDienMao(ghep(NEN, MON, 9, 9, true)).dan[0]!.lat).toBe(true);
    expect(docDienMao(ghep(NEN, MON, 9, 9, false)).dan[0]!.lat).toBe(false);
  });

  it('đổi vị trí thì bản xem trước đổi theo — nếu không, xem trước là trang trí', () => {
    const a = ghep(NEN, MON, 2, 2, false);
    const b = ghep(NEN, MON, 30, 30, false);
    expect(a).not.toBe(b);
  });

  it('mọi ô trong lưới đều ghép ra chuỗi đọc lại được', () => {
    for (const [x, y] of [[0, 0], [0, O_LUOI - 1], [O_LUOI - 1, 0], [O_LUOI - 1, O_LUOI - 1]]) {
      const dm = docDienMao(ghep(NEN, MON, x!, y!, false));
      expect(dm.dan[0], `ô (${x}, ${y}) rơi mất nhãn`).toBeDefined();
      expect(dm.dan[0]).toMatchObject({ x, y });
    }
  });
});

/*
 * ⚠ DÂY NỐI — bài trên chứng minh phép GHÉP đúng, bài này hỏi câu khác hẳn:
 * bản ghép có THẬT SỰ tới được chỗ vẽ không? Repo này đã dính 18+ lần cái bẫy
 * "cơ chế xây xong, có cả test, mà không ai gọi". Ghép đúng rồi quên truyền vào
 * `<Avatar>` thì mọi bài ở trên vẫn xanh và người chơi vẫn nhìn vào một ô trống.
 */
describe('dây nối: bản ghép có tới được chỗ vẽ không', () => {
  const CATALOG = {
    dan_toi_da: 8,
    mon: NHAN_DAN.slice(0, 2).map((m) => ({ id: m.id, ten: m.id })),
  } as never;
  const TAC_PHAM = {
    avatar_id: 'av1', seri: 1, so_dan: 0, chuoi: NEN,
  } as never;
  const KHO = [{ sticker_id: MON, so_luong: 2 }] as never;

  const dung = () => render(
    <QueryClientProvider client={makeQueryClient()}>
      <XuongDan tacPham={TAC_PHAM} kho={KHO} catalog={CATALOG} onDong={() => {}} />
    </QueryClientProvider>,
  );

  it('⭐ chọn nhãn + chọn ô ⇒ khung vẽ ĐỔI, không còn là nền trơn', async () => {
    const { container } = dung();
    const khungCua = () =>
      container.querySelector('[aria-label="Chọn vị trí dán trên khung"] svg')?.innerHTML ?? '';
    const veTruoc = khungCua();
    expect(veTruoc.length, 'khung chưa vẽ gì — bài test không đo được gì').toBeGreaterThan(0);

    // Chọn nhãn trong kho (nút radio đầu tiên), rồi bấm lên khung để đặt vị trí.
    const nhan = container.querySelector('[role="radio"]') as HTMLElement;
    expect(nhan, 'không tìm thấy ô kho nhãn').toBeTruthy();
    fireEvent.click(nhan);
    const khung = container.querySelector('[aria-label="Chọn vị trí dán trên khung"]') as HTMLElement;
    expect(khung, 'không tìm thấy khung tác phẩm').toBeTruthy();
    fireEvent.click(khung, { clientX: 10, clientY: 10 });

    expect(
      khungCua(),
      'khung vẽ KHÔNG đổi sau khi chọn nhãn + vị trí ⇒ bản ghép chưa tới được chỗ vẽ',
    ).not.toBe(veTruoc);
  });

  it('kho nhãn vẽ ART, không chỉ hiện tên chữ', () => {
    const { container } = dung();
    const o = container.querySelector('[role="radio"]')!;
    expect(o.querySelector('svg'), 'ô kho nhãn không có hình — vẫn là dòng chữ').toBeTruthy();
  });
});
