/**
 * THOẠI ORACLE BÁM Ô ĐANG RỌI (12/09) — founder: *"box chat này nó phải bám theo
 * phần mà nó đang kẻ ô hướng dẫn, kiểu là ở gần nhau cho dễ nhìn và thao tác 1
 * thể chứ hiện tại thì 2 cái cách xa nhau quá"*.
 *
 * Bản cũ chỉ CHỌN BÊN rồi dán mép màn (`bottom: 16px` / `top: 14px`): ô sáng ở
 * đầu màn thì câu giải thích nằm tận đáy. Nay thẻ neo theo khung ô.
 *
 * jsdom không có bố cục ⇒ giả `getBoundingClientRect` của phần tử neo và
 * `innerHeight`, rồi đọc style/`data-bam` thật của thẻ. Ba ca:
 *   1. ô ở ĐẦU màn, dưới rộng ⇒ thẻ xuống dưới ô (`top` = đáy ô + khe);
 *   2. ô ở ĐÁY màn ⇒ thẻ lên trên ô (`bottom` neo theo đỉnh ô);
 *   3. ô CAO gần hết màn ⇒ không bên nào đủ ⇒ về mép màn như cũ (bài học 03/08:
 *      chọn bên còn nhiều chỗ hơn, không xét tâm lỗ).
 * Tiêm lỗi 12/09: bỏ nhánh `duDuoi` (luôn dùng lớp mép) ⇒ bài 1 đỏ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CoachTap, type BoiCanhTap } from '../src/components/holdem/CoachTap';

const NEN: BoiCanhTap = {
  vong: 1, shopMo: false, bangMo: false, shopChonMa: false, coKetQua: false,
  loaiVongNay: 'tai_san', xong: false, onMoShop: () => {},
  // Bỏ qua hai bước chia vai.
  chaoVaiXong: true, chaoVaiPha: null,
  // D336 — sổ đã-qua lưu theo trận; `beforeEach` ghi sẵn dải ghế + mục tiêu là đã nghe,
  // để bước hiện là `mo-shop` (neo `nut-shop`, bước CHỜ TAY) như các bài dưới cần.
  khoaLuu: 'bam-o',
};
const CAO_MAN = 812;

/** Dựng phần tử neo `nut-shop` với khung giả — đúng thứ coach đo. */
function neoTai(top: number, height: number) {
  const el = document.createElement('div');
  el.setAttribute('data-tap', 'nut-shop');
  el.getBoundingClientRect = () => ({
    top, height, left: 20, width: 120, right: 140, bottom: top + height, x: 20, y: top,
    toJSON: () => ({}),
  }) as DOMRect;
  el.scrollIntoView = () => {};
  document.body.append(el);
}

const the = () => screen.getByRole('dialog');
/** Chờ vòng đo khung (interval 300 ms) + chữ chạy xong. */
const doXong = () => act(() => { vi.advanceTimersByTime(3000); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('innerHeight', CAO_MAN);
  window.sessionStorage.setItem('delphi:coach:bam-o', JSON.stringify({
    // D445 — hai bước đọc màu bàn chen giữa `muc-tieu` và `mo-shop`; bước kế vẫn là `mo-shop` (neo `nut-shop`).
    daQua: ['chia-vai', 'vai-cua-ban', 'vai', 'muc-tieu', 'la-mo-man', 'doan-la-ke'], tat: false,
  }));
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = '';
  window.sessionStorage.clear();
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

describe('thoại bám ô', () => {
  it('⭐ ô ở ĐẦU màn (dải đối thủ) ⇒ thẻ nằm NGAY DƯỚI ô, không rơi xuống đáy', () => {
    neoTai(100, 140);
    render(<CoachTap {...NEN} />);
    doXong();
    const t = the();
    expect(t.dataset['bam']).toBe('duoi');
    // top = đáy ô (240) + khe dưới (34).
    expect(t.style.top).toBe('274px');
    expect(t.style.bottom).toBe('');
    // Và nó KHÔNG còn mang lớp ghim mép.
    expect(t.className).not.toMatch(/theDuoi|theTren/);
  });

  it('⭐ ô ở ĐÁY màn (thanh tay cầm) ⇒ thẻ nằm NGAY TRÊN ô', () => {
    neoTai(650, 130);
    render(<CoachTap {...NEN} />);
    doXong();
    const t = the();
    expect(t.dataset['bam']).toBe('tren');
    // bottom = cao màn (812) − đỉnh ô (650) + khe trên (12).
    expect(t.style.bottom).toBe('174px');
    expect(t.style.top).toBe('');
  });

  it('ô CAO gần hết màn ⇒ không bên nào đủ chỗ ⇒ về mép màn, chọn bên rộng hơn', () => {
    neoTai(120, 600);   // trên 120 · dưới 92 — cả hai đều chật
    render(<CoachTap {...NEN} />);
    doXong();
    const t = the();
    expect(t.dataset['bam']).toBe('mep');
    expect(t.style.top).toBe('');
    expect(t.style.bottom).toBe('');
    expect(t.className).toMatch(/theTren/);   // trên rộng hơn dưới
  });

  it('bước KHÔNG có ô để rọi ⇒ vẫn về mép màn, không nổ vì thiếu khung', () => {
    // Không dựng neo nào ⇒ `khung` null ⇒ màn nhuộm đều.
    render(<CoachTap {...NEN} />);
    doXong();
    expect(the().dataset['bam']).toBe('mep');
  });
});

/*
 * ═══ LƯỚI CHỐNG KẸT ════════════════════════════════════════════════════════
 * Bước CHỜ TAY cố ý không có nút TIẾP. Nhưng nếu neo nó rọi vào không có trên
 * màn — người chơi bấm linh tinh, một khối vừa đóng, hay neo đặt nhầm sau một
 * cái cổng (đúng lỗi `vi-sao` sống từ 08/09 tới 12/09) — thì không còn gì để
 * bấm và cũng không có nút TIẾP: kẹt cứng, chỉ còn BỎ QUA cả trợ lý.
 * Founder 12/09: *"bước này bị kẹt và nếu t đ** bỏ qua thì ko sang bước tiếp
 * theo được"*. Neo vắng hai nhịp đo ⇒ mở nút cho đi tiếp.
 * Tiêm lỗi: đổi `(!buoc.tuXong || neoMat)` về `!buoc.tuXong` ⇒ bài đầu đỏ.
 */
describe('lưới chống kẹt — neo biến mất thì vẫn đi tiếp được', () => {
  it('⭐⭐ bước chờ tay + neo KHÔNG có trên màn ⇒ hiện nút bỏ qua bước', () => {
    render(<CoachTap {...NEN} />);          // không dựng neo `nut-shop`
    doXong();
    expect(screen.getByRole('button', { name: /BỎ QUA BƯỚC NÀY/ })).toBeInTheDocument();
  });

  it('⭐ neo CÓ trên màn ⇒ vẫn chờ tay như cũ, không nút nào cho đi tắt', () => {
    neoTai(100, 140);
    render(<CoachTap {...NEN} />);
    doXong();
    expect(screen.queryByRole('button', { name: /BỎ QUA BƯỚC NÀY|TIẾP ▸/ })).toBeNull();
  });

  it('⭐ neo hiện lại ⇒ nút đi tắt biến mất, trợ lý về đúng nếp cầm tay chỉ việc', () => {
    render(<CoachTap {...NEN} />);
    doXong();
    expect(screen.getByRole('button', { name: /BỎ QUA BƯỚC NÀY/ })).toBeInTheDocument();
    neoTai(100, 140);
    doXong();
    expect(screen.queryByRole('button', { name: /BỎ QUA BƯỚC NÀY/ })).toBeNull();
  });

  /*
   * ⚠ D336 — LƯỚI KHÔNG ĐƯỢC BỊ CHÍNH TRỢ LÝ ĐÁNH LỪA. Thẻ thoại bấm được
   * (`pointer-events: auto`); đậu đè lên tâm neo là `elementFromPoint` trả về nó, và
   * lưới cũ mời người chơi bỏ đúng thao tác đang dạy (đo 15/09 ở bước chip 25%).
   * Tiêm lỗi: bỏ vế `closest('[data-coach]')` ⇒ bài đầu đỏ.
   */
  it('⭐⭐ thứ đè lên neo là CHÍNH thẻ thoại ⇒ không coi là bị che', () => {
    neoTai(700, 40);
    render(<CoachTap {...NEN} />);
    document.elementFromPoint = () => screen.getByRole('dialog');
    doXong();
    expect(screen.queryByRole('button', { name: /BỎ QUA BƯỚC NÀY/ })).toBeNull();
  });

  it('⭐ thứ đè lên neo là một lớp KHÁC ⇒ vẫn mở đường đi tiếp (lưới còn sống)', () => {
    neoTai(700, 40);
    const tam = document.createElement('div');
    document.body.append(tam);
    render(<CoachTap {...NEN} />);
    document.elementFromPoint = () => tam;
    doXong();
    expect(screen.getByRole('button', { name: /BỎ QUA BƯỚC NÀY/ })).toBeInTheDocument();
  });
});

/*
 * ═══ TẤM "VÌ SAO" CHE NÚT ⇒ TRỢ LÝ PHẢI ĐÓNG NÓ ════════════════════════════
 * Founder 12/09: *"nếu t ko đóng tab vì sao mà chỉ bấm tiếp tục thì đến bước 13
 * nó bị kẹt"*. Tấm `position: fixed` (z-index 76) phủ kín đáy màn, nên nút SHOP
 * ở thanh tay cầm vẫn được RỌI SÁNG mà bấm không tới — lưới `neoMat` cũ im vì
 * neo vẫn tồn tại. Hai lớp vá, bài này canh lớp thứ nhất (dàn cảnh):
 * bước rọi vào nút dưới tấm phải khai `lyDo: false`, và trợ lý đóng tấm hộ.
 * Tiêm lỗi: bỏ `lyDo: false` khỏi `mo-shop` ⇒ bài đầu đỏ.
 */
describe('dàn cảnh tấm VÌ SAO', () => {
  it('⭐⭐ vào bước rọi nút dưới tấm mà tấm đang mở ⇒ trợ lý đóng tấm', () => {
    const moLyDoSpy = vi.fn();
    neoTai(700, 40);
    render(<CoachTap {...NEN} moLyDo onMoLyDo={moLyDoSpy} />);
    doXong();
    expect(moLyDoSpy).toHaveBeenCalledWith(false);
  });

  it('⭐ tấm đã đóng sẵn ⇒ không gọi lại, không giành nút với người chơi', () => {
    const moLyDoSpy = vi.fn();
    neoTai(700, 40);
    render(<CoachTap {...NEN} moLyDo={false} onMoLyDo={moLyDoSpy} />);
    doXong();
    expect(moLyDoSpy).not.toHaveBeenCalled();
  });

  it('người gọi cũ không truyền `onMoLyDo` ⇒ không nổ, chỉ là không dàn cảnh', () => {
    neoTai(700, 40);
    expect(() => { render(<CoachTap {...NEN} moLyDo />); doXong(); }).not.toThrow();
  });
});

/*
 * ═══ TỜ (!) PHẢI ĐỨNG TRÊN TRỢ LÝ ══════════════════════════════════════════
 * Founder 12/09: *"khi t bấm vào để đọc giải thích thì khung delphi che
 * mất text"*. Tờ giải thích là modal người chơi CHỦ ĐỘNG mở để ĐỌC; lớp phủ
 * hướng dẫn cùng z-index 80 nên lớp vẽ sau (khung thoại Oracle) thắng và nằm đè
 * lên chữ. Bài này khoá thứ tự lớp bằng nguồn CSS, không bằng mắt.
 * Tiêm lỗi: hạ `.lop` về 80 ⇒ đỏ.
 */
describe('tờ (!) đang mở ⇒ trợ lý nấp', () => {
  /*
   * ⚠⚠ BÀI ĐẦU TIÊN TÔI VIẾT CHO CA NÀY LÀ MỘT BÀI XANH GIẢ. Nó so z-index trong
   * NGUỒN CSS (tờ 84 > lớp phủ 80) rồi kết luận "tờ nằm trên". Sai: tờ sống bên
   * trong lớp phủ SHOP, mà shop tạo NGỮ CẢNH XẾP LỚP riêng — z-index bên trong
   * chỉ so với nhau. Đo trên DOM thật: `elementFromPoint` giữa khung thoại vẫn
   * trả về chữ của Oracle, tức tờ VẪN bị che dù bài canh xanh.
   * ⇒ Canh HÀNH VI, không canh con số: tờ mở thì trợ lý không được vẽ gì cả.
   * Tiêm lỗi: bỏ `&& b.toMo !== true` khỏi `hien` ⇒ đỏ.
   */
  it('⭐⭐ tờ (!) mở ⇒ không đèn rọi, không khung thoại; Oracle co thành một dòng ở MÉP TRÊN', () => {
    neoTai(300, 60);
    const { container } = render(<CoachTap {...NEN} toMo />);
    doXong();
    expect(screen.queryByRole('dialog'), 'khung thoại vẫn đứng trước thứ người chơi đang đọc').toBeNull();
    // `_lo_` chứ không `lo`: lớp `glow` của linh vật cũng chứa "lo".
    expect(container.querySelector('[class*="_lo_"]'), 'đèn rọi vẫn khoét lỗ trên trang đang đọc').toBeNull();
    // D336 — founder: "delphi phải luôn xuất hiện". Tờ nằm ở nửa dưới ⇒ dòng thu gọn lên mép trên.
    const dock = container.querySelector('[data-dock]');
    expect(dock, 'Oracle biến mất hẳn trong lúc người chơi đọc tờ').not.toBeNull();
    expect(dock!.getAttribute('data-dock')).toBe('tren');
    expect(dock!.textContent).toContain('đóng tờ');
  });

  it('⭐ đóng tờ ⇒ trợ lý hiện lại đúng bước đang dở', () => {
    neoTai(300, 60);
    const { rerender } = render(<CoachTap {...NEN} toMo />);
    doXong();
    rerender(<CoachTap {...NEN} toMo={false} />);
    doXong();
    expect(screen.getByRole('dialog').textContent).toContain('Chạm SHOP');
  });
});

/*
 * ═══ ORACLE THU GỌN (D336) ═════════════════════════════════════════════════
 * Founder 15/09: *"delphi phải luôn xuất hiện chứ đ** phải biến mất luôn"*. Không bước nào
 * tới lượt ⇒ một dòng gợi ý, không đèn rọi, không cướp chạm.
 * Tiêm lỗi: cho `CoachTap` trả `null` khi không có bước ⇒ bài đầu đỏ.
 */
describe('Oracle thu gọn khi không bước nào tới lượt', () => {
  const RANH: BoiCanhTap = {
    ...NEN, khoaLuu: 'ranh', vong: 6, coKetQua: true, chaoVaiXong: true,
    loaiVongNay: 'tai_san', vongTamDungDen: 9,
  };
  // D445 — vòng 6 nay có bài `mau-xanh` (bàn chuyển xanh); đánh dấu nó đã qua để vòng thành "không bài nào tới lượt".
  beforeEach(() => {
    window.sessionStorage.setItem('delphi:coach:ranh', JSON.stringify({ daQua: ['mau-xanh'], tat: false }));
  });

  it('⭐⭐ vòng không có bài dạy ⇒ vẫn có Oracle, nói việc của màn, không nhuộm đen', () => {
    const { container } = render(<CoachTap {...RANH} />);
    doXong();
    expect(screen.queryByRole('dialog')).toBeNull();
    const dock = container.querySelector('[data-dock]');
    expect(dock, 'Oracle biến mất khi không có bước').not.toBeNull();
    expect(dock!.textContent).toContain('SHOP');
    expect(container.querySelector('[class*="_mangToan_"]')).toBeNull();
  });

  it('⭐ sân khấu đang diễn (ô lật) ⇒ Oracle đứng ngoài, cả dạng thu gọn', () => {
    const { container } = render(<CoachTap {...RANH} sanKhau />);
    doXong();
    expect(container.querySelector('[data-dock]')).toBeNull();
  });

  it('⭐ BỎ QUA ✕ ⇒ không còn bài dạy, nhưng Oracle ngồi lại với nút DẮT TIẾP; bấm là nói tiếp', () => {
    neoTai(100, 140);
    render(<CoachTap {...NEN} />);
    doXong();
    act(() => { screen.getByText('BỎ QUA ✕').click(); });
    doXong();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { screen.getByText('DẮT TIẾP ▸').click(); });
    doXong();
    expect(screen.getByRole('dialog').textContent).toContain('Chạm SHOP');
  });
});

/*
 * ═══ D336 LƯỢT 2 — BẤM ĐÚNG VIỆC THÌ ORACLE LUI NGAY; VIỆC XONG SẴN THÌ KHÔNG NHÁY RỒI MẤT ═══
 * Founder 15/09: *"Vòng 3/12 chỗ giải thích sự kiện trượt giá … khi t bấm vào lý do để xem thì oracle
 * ko ẩn đi ngay mà phải ấn vào nút vàng tiếp tục thì oracle mới ẩn"*.
 * Tiêm lỗi: (a) bỏ `tuXong` ở `truot-gia` ⇒ bài đầu đỏ; (b) ghi `daHien` cả khi việc đã xong sẵn
 * (bỏ `if (!viecDaXong)` trong CoachTap) ⇒ hai bài "không nháy" đỏ.
 */
import { KICH_BAN as KB } from '../src/components/holdem/CoachTap';

describe('D336 lượt 2 — việc của bước và khung thoại', () => {
  const MACH = KB.filter((x) => x.lan !== 'khi').map((x) => x.id);
  const V3: BoiCanhTap = {
    ...NEN, khoaLuu: 'luot2', vong: 3, coKetQua: true, coChenChuc: true, loaiVongNay: 'tai_san',
  };
  const giaSo = (daQua: readonly string[]) => window.sessionStorage.setItem(
    'delphi:coach:luot2', JSON.stringify({ daQua, tat: false }),
  );

  it('⭐⭐ trượt giá hiện ⇒ người chơi mở VÌ SAO ⇒ khung thoại LUI NGAY, còn dòng thu gọn ở mép trên', () => {
    giaSo(MACH);
    const { rerender, container } = render(<CoachTap {...V3} moLyDo={false} />);
    doXong();
    expect(screen.getByRole('dialog').getAttribute('data-buoc')).toBe('truot-gia');
    rerender(<CoachTap {...V3} moLyDo />);
    doXong();
    expect(screen.queryByRole('dialog'), 'mở VÌ SAO rồi mà khung thoại vẫn đè lên tấm').toBeNull();
    expect(container.querySelector('[data-dock="tren"]')).not.toBeNull();
  });

  /*
   * Đo trên dev vòng 4 (15/09 tối): mở VÌ SAO xong bước trượt giá, và ngay khung hình sau bước "lộ tin
   * giả" — cùng làn — bật lên đè lên tấm vừa mở. Luật: tấm đang mở thì làn khi-xảy-ra chỉ được XONG, không
   * được HIỆN; tấm đóng thì bước dở quay lại. Tiêm lỗi: bỏ `if (b.moLyDo === true) continue;` ⇒ đỏ.
   */
  it('⭐⭐ VÌ SAO đang mở ⇒ làn khi-xảy-ra KHÔNG đè lên tấm (không bị mất: đóng tấm là nó nói)', () => {
    giaSo(MACH);
    const { rerender, container } = render(<CoachTap {...V3} moLyDo />);
    doXong();
    expect(screen.queryByRole('dialog'), 'khung thoại đè lên tấm người chơi đang đọc').toBeNull();
    expect(container.querySelector('[data-dock]')!.textContent).toContain('ẨN LÝ DO');
    rerender(<CoachTap {...V3} moLyDo={false} />);
    doXong();
    expect(screen.getByRole('dialog').getAttribute('data-buoc'), 'đóng tấm mà bước dở không quay lại').toBe('truot-gia');
  });

  it('⭐ bước kể ô (`keO`) mà việc đã làm trước (chip 🏦 mở sẵn) ⇒ nói đủ câu, chờ TIẾP', () => {
    const truocV4 = KB.slice(0, KB.findIndex((x) => x.id === 'chuyen-v4')).map((x) => x.id);
    giaSo(truocV4);
    render(<CoachTap {...NEN} khoaLuu="luot2" vong={4} coKetQua moLaiSuat loaiVongNay="chien_thuat" />);
    doXong();
    doXong();
    expect(screen.getByRole('dialog').getAttribute('data-buoc')).toBe('chuyen-v4');
    expect(screen.getByRole('button', { name: 'TIẾP ▸' })).toBeInTheDocument();
  });

  it('⭐ BỎ QUA ✕ trong màn tập ⇒ máy ghi "đã qua màn tập" (sảnh thôi dắt vào)', () => {
    window.localStorage.removeItem('delphi:man-tap:da-qua');
    neoTai(100, 140);
    render(<CoachTap {...NEN} />);
    doXong();
    act(() => { screen.getByText('BỎ QUA ✕').click(); });
    expect(window.localStorage.getItem('delphi:man-tap:da-qua')).toBe('bo_qua');
    window.localStorage.removeItem('delphi:man-tap:da-qua');
  });

  /*
   * Founder 15/09: *"chẳng có chỗ nào giải thích tài sản nào sẽ hưởng lợi/ bị giảm"*. Dải hai phe vẽ
   * sáu mã theo PHE catalog, và ở bước kể tin thì mức dưới mỗi mã đọc từ tờ (!) — không số.
   * Tiêm lỗi: đổi `t.nhom === phe` thành `true` ⇒ bài đầu đỏ (mỗi phe sáu mã).
   */
  const TS = [
    { id: 'btc', label: 'Crypto', nhom: 'rui_ro' as const, svg: '<svg></svg>' },
    { id: 'cp_cn', label: 'Cổ tech', nhom: 'rui_ro' as const },
    { id: 'vn30', label: 'Blue-chip', nhom: 'rui_ro' as const },
    { id: 'vang', label: 'Vàng', nhom: 'phong_thu' as const },
    { id: 'usd', label: 'Stablecoin', nhom: 'phong_thu' as const },
    { id: 'tpcp', label: 'Trái phiếu', nhom: 'phong_thu' as const },
  ];

  it('⭐⭐ vòng 1 trong shop: dải HAI PHE — ba mã rủi ro | ba mã phòng thủ, không mũi tên', () => {
    giaSo(KB.slice(0, KB.findIndex((x) => x.id === 'hai-phe')).map((x) => x.id));
    render(<CoachTap {...NEN} khoaLuu="luot2" shopMo taiSanTap={TS} />);
    doXong();
    const the = screen.getByRole('dialog');
    expect(the.getAttribute('data-buoc')).toBe('hai-phe');
    const dai = the.querySelector('[data-hinh="phe"]');
    expect(dai, 'bước hai phe mà không vẽ dải').not.toBeNull();
    expect([...dai!.querySelectorAll('[data-phe="rui_ro"] [data-ma]')].map((e) => e.getAttribute('data-ma')))
      .toEqual(['btc', 'cp_cn', 'vn30']);
    expect([...dai!.querySelectorAll('[data-phe="phong_thu"] [data-ma]')].map((e) => e.getAttribute('data-ma')))
      .toEqual(['vang', 'usd', 'tpcp']);
    expect(dai!.textContent).not.toMatch(/[▲▼]/);
  });

  it('⭐ vòng 4 "TIỀN RẺ": dải mức của tin Hạ lãi suất đọc từ tờ (!), mã thiếu mức ⇒ trung tính', () => {
    giaSo(KB.slice(0, KB.findIndex((x) => x.id === 'lai-suat')).map((x) => x.id));
    const tuDien = {
      btc: { su_kien: [['ha_lai_suat', 'rat_tot']] as const },
      usd: { su_kien: [['ha_lai_suat', 'xau']] as const },
    };
    render(
      <CoachTap {...NEN} khoaLuu="luot2" vong={4} coKetQua moLaiSuat loaiVongNay="chien_thuat" taiSanTap={TS} tuDienTap={tuDien} />,
    );
    doXong();
    const the = screen.getByRole('dialog');
    expect(the.getAttribute('data-buoc')).toBe('lai-suat');
    const dai = the.querySelector('[data-hinh="ha_lai_suat"]')!;
    expect(dai).not.toBeNull();
    expect(dai.querySelector('[data-ma="btc"]')!.getAttribute('aria-label')).toBe('Crypto: rất khoẻ');
    expect(dai.querySelector('[data-ma="usd"]')!.getAttribute('aria-label')).toBe('Stablecoin: yếu');
    expect(dai.querySelector('[data-ma="vang"]')!.getAttribute('aria-label')).toBe('Vàng: trung tính');
  });
});
