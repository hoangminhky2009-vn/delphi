/**
 * MÀN KẾT BENTO — SPEC `docs/spec/alpha-draft-tang-khong-gian.md` phần A, mục 4.2 + 5 + 5b (THI CÔNG, demo CHỐT 11/10).
 *
 * Dựng `ManKet` với payload `/autopsy` thật hình (fixture). Bài khoá:
 *   I.   Mặt màn: ô CỦA MÌNH (hạng · vốn · lá) + ô PHONG CÁCH LỚN NHẤT dùng ĐÚNG `PhongCachKet`/`ThanhPhongCach` thật (thang E→SSS) + bốn ô nhỏ;
 *        chi tiết (lá đã cầm · giải nghĩa trục · lật bài · bản đồ · thẻ khoe · dấu mốc/đội) KHÔNG nằm trên mặt khi lớp đóng.
 *   II.  Mọi khối cũ còn tới được trong ≤ 1 chạm: từng ô → lớp trượt có đúng nội dung của nó.
 *   III. Trạng thái: thắng (hạng 1) · cháy tài khoản · thiếu phong cách (không bịa hạng) · thẻ đang giữ (tester).
 *   IV.  VỀ SẢNH: bấm đúp = MỘT lần; `html[data-man-ket]` bật/tắt theo vòng đời (khung không cuộn cần nó).
 *   V.   A10: chữ trong mọi lớp trượt là MÔ TẢ, không kê đơn.
 * Số đo không cuộn thật (scrollHeight − clientHeight) ở `tests/luong/trinh-duyet/alpha_draft_bento.mjs` (jsdom không có layout).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeQueryClient } from '@/api/queries';
import type { AutopsyDTO, CatalogDTO } from '@/api/holdem';
import { ManKet, type ManKetProps } from '@/screens/holdem/ManKet';
import { tuKeDonTrong } from '@/lib/khoanh_khac';
import { ME_ONBOARDED, stubFetch } from './helpers';

vi.setConfig({ testTimeout: 30_000 });
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const cho = (ms: number) => new Promise((r) => { setTimeout(r, ms); });

const CAT = {
  engine_version: 'x', balance_version: 'balance-v66',
  luat: { START_VON: 10000 },
  tai_san: [{ id: 'btc', label: 'Crypto' }, { id: 'vang', label: 'Vàng' }, { id: 'cp_cn', label: 'Cổ phiếu Tech' }],
  chien_thuat: [{ id: 'don_bay', label: 'Đòn bẩy' }, { id: 'luot_song', label: 'Lướt sóng' }, { id: 'bat_day', label: 'Bắt đáy' }],
  giai_doan: [{ id: 'tang', label: 'Tăng' }, { id: 'giam', label: 'Giảm' }],
  su_kien: [{ id: 'tin_lai', label: 'Tin lãi suất' }, { id: 'tin_gia', label: 'Tin đồn' }],
} as unknown as CatalogDTO;
const ART = { btc: '<svg viewBox="0 0 2 2"><rect width="2" height="2"/></svg>' };

const GHE = [
  ['ban', 'nguoi', 'orca_21', 'Cá Ngừ'], ['g1', 'bot', 'Máy · Cá Mập', 'Cá Mập'], ['g2', 'bot', 'Máy · Orca', 'Cá Heo'],
  ['g3', 'nguoi', 'lan_anh', 'Cá Mòi'], ['g4', 'bot', 'Máy · Giờ', 'Cua'], ['g5', 'nguoi', 'minh_quan', 'Tôm'],
] as const;
const autopsy = (hang = 3, them: Partial<AutopsyDTO> = {}): AutopsyDTO => ({
  match_id: 'm-x', xong: true,
  xep_hang: GHE.map(([ghe_id, loai, ten, bac_rank], i) => ({
    hang: ghe_id === 'ban' ? hang : (i < hang ? i : i + 1), ghe_id, loai, ten, bac_rank,
    von: ghe_id === 'ban' ? (hang === 6 ? 0 : 11840) : 9000 + i * 300, vong_chay: ghe_id === 'ban' && hang === 6 ? 6 : null,
    danh_muc: ghe_id === 'ban'
      ? { tai_san: ['btc', 'vang', 'cp_cn'], chien_thuat: ['don_bay', 'luot_song'] }
      : { tai_san: ['vang'], chien_thuat: ['bat_day'] },
    diem_truoc: ghe_id === 'ban' ? 100 : null, diem_sau: ghe_id === 'ban' ? 124 : null,
  })).sort((a, b) => a.hang - b.hang),
  map_da_lo: Array.from({ length: 14 }, (_, i) => (i % 4 === 3
    ? { kind: 'su_kien', su_kien: i === 7 ? 'tin_gia' : 'tin_lai', la_tin_gia: i === 7 || i === 11 }
    : { kind: 'giai_doan', giai_doan: i % 2 ? 'tang' : 'giam' })),
  khoanh_khac: [{ id: 'tin_gia', vong: 6, delta_bp: -3140 }],
  nang_luc: { formula_version: 1, tinh_vao_the: true, ly_do_khong_tinh: null,
    nang_luc: [{ id: 'doc_tin', bac: 'lam_duoc', bang_chung: { so_vong: 8 } }, { id: 'phan_tan', bac: 'da_gap', bang_chung: {} }] },
  phong_cach: { diem: 742, hang: 'A', streak: 2, streak_dai_nhat: 4, ba_truc: { doc: 0.71, thang_cho: 0.64, tru: 0.8 } },
  nav_theo_vong: [{ vong: 1, nav: { ban: 10000, g1: 10000 } }, { vong: 2, nav: { ban: 10400, g1: 9900 } }],
  dau_moc: [{ id: 'chuoi_dung_huong', vong: 9, so: 3 }],
  ban_ma: null,
  ...them,
} as AutopsyDTO);

function dung(du: AutopsyDTO, them: Partial<ManKetProps> = {}) {
  stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);
  const onVeSanh = vi.fn();
  const r = render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <ManKet du={du} cat={CAT} art={ART} tongVong={14} banMa={null} doiBan={undefined} onVeSanh={onVeSanh} {...them} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...r, onVeSanh };
}
const o = (dau: string) => document.querySelector(`[data-o="${dau}"]`) as HTMLElement;
const lop = () => document.querySelector('[role="dialog"][data-tam]') as HTMLElement | null;
const chuTrang = () => document.body.textContent ?? '';
async function moLop(dau: string) {
  fireEvent.click(o(dau));
  await waitFor(() => expect(lop()).toBeTruthy());
  return lop()!;
}
async function dongLop() {
  fireEvent.click(within(lop()!).getByText('ĐÓNG'));
  await waitFor(() => expect(lop()).toBeNull());
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('I. Mặt màn — ô của mình + PHONG CÁCH lớn nhất + bốn ô nhỏ', () => {
  it('⭐ ô CỦA MÌNH: hạng 3/6 · vốn · % · các lá đã cầm (đúng 5) · dòng điểm', () => {
    dung(autopsy());
    const toi = o('toi');
    expect(toi.textContent).toContain('3');
    expect(toi.textContent).toContain('/6');
    expect(toi.textContent).toContain('+18%');
    expect(toi.querySelectorAll('[title]')).toHaveLength(5);
    expect(toi.textContent).toContain('+24 điểm · thu từ 3 người xếp dưới');
  });

  it('⭐⭐ ô PHONG CÁCH = `PhongCachKet` + `ThanhPhongCach` THẬT (thang E→SSS: hạng A, điểm 742/1000, ba trục %), không thanh tĩnh', () => {
    dung(autopsy());
    const pc = o('pc');
    expect(pc.querySelector('[data-tap="phong-cach-ket"]'), 'thiếu khối phong cách thật').not.toBeNull();
    const thanh = pc.querySelector('[data-tap="phong-cach"]') as HTMLElement;
    expect(thanh, 'thiếu thanh chấm điểm thật (ThanhPhongCach)').not.toBeNull();
    expect(thanh.getAttribute('data-hang')).toBe('A');
    expect(pc.textContent).toContain('742 / 1000');
    for (const t of ['ĐỌC', 'THẮNG CHỢ', 'TRỤ']) expect(pc.textContent).toContain(t);
    expect(pc.textContent).toContain('71%');
    expect(pc.textContent).toContain('chuỗi dài nhất ×4');
    expect(pc.querySelector('[role="img"][aria-label="Hạng A"]')).not.toBeNull();
  });

  it('⭐ ô PHONG CÁCH là ô lớn nhất: chiếm hàng giãn (1fr) còn ô của mình / ô nhỏ chỉ `auto` (đọc từ CSS — jsdom không có layout)', () => {
    const css = doc('src/screens/holdem/ManKet.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(/grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/.test(css), 'hàng giữa (PHONG CÁCH) phải là hàng giãn').toBe(true);
    expect(css).toMatch(/\.luoi \.oPc\s*\{[^}]*grid-column:\s*1 \/ 5/);
    expect(css).toMatch(/\.luoi \.oToi\s*\{[^}]*grid-column:\s*1 \/ 5/);
  });

  it('⭐ bốn ô nhỏ: LẬT BÀI (5 ghế) · BẢN ĐỒ (2 tin bịa) · KHOE (thẻ kết trận) · ĐỘI (dấu mốc)', () => {
    dung(autopsy());
    expect(o('lat').textContent).toContain('LẬT BÀI');
    expect(o('lat').textContent).toContain('5 ghế');
    expect(o('ban').textContent).toContain('2 tin bịa');
    expect(o('khoe').textContent).toContain('thẻ kết trận');
    expect(o('doi').textContent).toContain('dấu mốc');
  });

  it('⭐⭐ lớp ĐÓNG: không chi tiết nào trên MẶT màn (giải nghĩa trục · lá đã cầm · tên đối thủ · bản đồ · thẻ khoe · dấu mốc); lớp không có trong DOM', () => {
    dung(autopsy());
    const t = chuTrang();
    for (const chi of ['đoán đúng mã lời nhất tới đâu', 'LÁ ĐÃ CẦM', 'lan_anh', 'minh_quan', 'TIN GIẢ', 'tin trong map là bịa', 'THẺ KẾT TRẬN', 'BA VÒNG LIỀN ĐÚNG HƯỚNG', 'GHI VÀO THẺ', 'HÔM NAY BẠN VỪA CHẠM']) {
      expect(t, `"${chi}" nằm trên mặt màn`).not.toContain(chi);
    }
    expect(lop()).toBeNull();
  });

  it('chữ hạng KHÔNG phải số 0 giả: ô của mình luôn có hạng thật từ server', () => {
    dung(autopsy(1));
    expect(o('toi').textContent).toMatch(/1\/6|1.*\/6/);
  });
});

describe('II. Mọi khối cũ tới được trong ≤ 1 chạm (lớp trượt)', () => {
  it('⭐ ô CỦA MÌNH → LÁ ĐÃ CẦM: đủ 5 lá có tên + loại (tài sản / lõi)', async () => {
    dung(autopsy());
    const l = await moLop('toi');
    expect(l.textContent).toContain('LÁ ĐÃ CẦM');
    for (const ten of ['Crypto', 'Vàng', 'Cổ phiếu Tech', 'Đòn bẩy', 'Lướt sóng']) expect(l.textContent, ten).toContain(ten);
    expect(l.textContent).toContain('tài sản');
    expect(l.textContent).toContain('lõi');
    await dongLop();
  });

  it('⭐ PHONG CÁCH → bản đầy đủ: giải nghĩa từng trục + GHI VÀO THẺ + HÔM NAY BẠN VỪA CHẠM + link XEM THẺ', async () => {
    dung(autopsy());
    const l = await moLop('pc');
    expect(l.textContent).toContain('đoán đúng mã lời nhất tới đâu');
    expect(l.textContent).toContain('hơn hay kém mặt bằng cả bảng');
    expect(l.textContent).toContain('giữ được bao nhiêu lúc chợ sập');
    expect(within(l).getByTestId('ghi-vao-the')).toBeTruthy();
    expect(l.textContent).toContain('HÔM NAY BẠN VỪA CHẠM');
    expect(l.querySelector('a[href*="/ho-so"]'), 'mất đường tới thẻ').not.toBeNull();
    await dongLop();
  });

  it('⭐ LẬT BÀI → mọi ghế còn lại (5): tên · bậc · vốn · lá của họ', async () => {
    dung(autopsy());
    const l = await moLop('lat');
    for (const ten of ['Máy · Cá Mập', 'Máy · Orca', 'lan_anh', 'Máy · Giờ', 'minh_quan']) expect(l.textContent, ten).toContain(ten);
    expect(l.textContent).not.toContain('orca_21');
    expect(l.querySelectorAll('[title="Vàng"]').length).toBeGreaterThanOrEqual(5);
    await dongLop();
  });

  it('⭐ BẢN ĐỒ → 14 ô, đúng 2 ô đóng dấu TIN GIẢ + câu "2 tin trong map là bịa"', async () => {
    dung(autopsy());
    const l = await moLop('ban');
    expect(l.textContent!.match(/TIN GIẢ/g)).toHaveLength(2);
    expect(l.textContent).toContain('tin trong map là bịa — giờ mới lộ.');
    expect(l.textContent).toContain('14 Ô · 2 TIN BỊA');
    await dongLop();
  });

  it('⭐ KHOE → thẻ kết trận với CHIA SẺ · LƯU ẢNH', async () => {
    dung(autopsy());
    const l = await moLop('khoe');
    expect(l.textContent).toContain('THẺ KẾT TRẬN');
    expect(within(l).getByRole('button', { name: /CHIA SẺ/ })).toBeTruthy();
    expect(within(l).getByRole('button', { name: /LƯU ẢNH/ })).toBeTruthy();
    await dongLop();
  });

  it('⭐ ĐỘI → DẤU MỐC kỹ năng (chữ ở client, server chỉ ID + số)', async () => {
    dung(autopsy());
    const l = await moLop('doi');
    expect(l.textContent).toContain('BA VÒNG LIỀN ĐÚNG HƯỚNG');
    expect(l.textContent).toContain('3 vòng liên tiếp bạn đứng đúng phía, chuỗi khép ở vòng 9.');
    await dongLop();
  });

  it('⭐ Esc đóng lớp + TRẢ FOCUS về đúng ô đã mở', async () => {
    dung(autopsy());
    o('lat').focus();
    fireEvent.click(o('lat'));
    await waitFor(() => expect(lop()).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(lop()).toBeNull());
    expect(document.activeElement).toBe(o('lat'));
  });
});

describe('III. Trạng thái không nói dối', () => {
  it('⭐ CHÁY TÀI KHOẢN: chip "CHÁY TÀI KHOẢN · VÒNG 6", KHÔNG dòng điểm lãi', () => {
    dung(autopsy(6));
    expect(o('toi').textContent).toContain('CHÁY TÀI KHOẢN · VÒNG 6');
    expect(o('toi').textContent).not.toContain('+24 điểm');
  });

  it('⭐ đấu TỰ DO (không tính điểm — `diem_sau` null): nói thẳng, không để trống (D31)', () => {
    const du = autopsy();
    du.xep_hang.find((h) => h.ghe_id === 'ban')!.diem_sau = null;
    dung(du);
    expect(o('toi').textContent).toContain('Đấu tự do · bàn có máy, không tính điểm');
  });

  it('⭐ THIẾU phong cách (API cũ): KHÔNG bịa hạng — ô nói "chưa có hạng phong cách", không khối phong cách thật', () => {
    dung(autopsy(3, { phong_cach: undefined }));
    expect(o('pc').textContent).toContain('trận này chưa có hạng phong cách');
    expect(o('pc').querySelector('[data-tap="phong-cach-ket"]')).toBeNull();
    expect(o('pc').querySelector('[data-tap="phong-cach"]')).toBeNull();
  });

  it('⭐ THẺ ĐANG GIỮ (tester chưa nộp PHIẾU 2, D370): lớp PHONG CÁCH NÓI RA, ô không vẽ dấu kỹ năng', async () => {
    dung(autopsy(3, { the_dang_giu: true }));
    expect(o('pc').textContent).not.toMatch(/LỌC TIN|làm được/i);
    const l = await moLop('pc');
    expect(within(l).getByTestId('the-dang-giu')).toBeTruthy();
    expect(within(l).queryByTestId('ghi-vao-the')).toBeNull();
  });

  it('ô PHONG CÁCH có ba dấu kỹ năng TĨNH (không nút lồng trong nút): ghi vào thẻ trên mặt ô', () => {
    dung(autopsy());
    const pc = o('pc');
    expect(pc.querySelectorAll('[data-testid^="dau-tinh-"]').length).toBeGreaterThanOrEqual(1);
    expect(pc.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('IV. VỀ SẢNH + vòng đời', () => {
  it('⭐ ▶ VỀ SẢNH: bấm đúp = MỘT lần onVeSanh (không đi hai bước)', async () => {
    const { onVeSanh, getByRole } = dung(autopsy());
    const nut = getByRole('button', { name: /VỀ SẢNH/ });
    fireEvent.click(nut); fireEvent.click(nut);
    await cho(400);
    expect(onVeSanh).toHaveBeenCalledTimes(1);
  });

  it('⭐ `html[data-man-ket]` bật khi màn sống, tắt khi gỡ (AppShell hạ min-height về 100dvh nhờ nó)', () => {
    const { unmount } = dung(autopsy());
    expect(document.documentElement.hasAttribute('data-man-ket')).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute('data-man-ket')).toBe(false);
    const vo = doc('src/app/AppShell.module.css');
    expect(vo).toMatch(/:global\(html\[data-man-ket\]\)\s+\.shell\s*\{\s*min-height:\s*100dvh/);
  });
});

describe('V. A10 — chữ trong lớp trượt là MÔ TẢ, không kê đơn', () => {
  it('⭐ quét chữ của mọi lớp (mở lần lượt): không từ kê đơn', async () => {
    dung(autopsy());
    for (const dau of ['toi', 'pc', 'lat', 'ban', 'khoe', 'doi']) {
      const l = await moLop(dau);
      expect(tuKeDonTrong(l.textContent ?? ''), `lớp ${dau} có từ kê đơn`).toEqual([]);
      await dongLop();
    }
  });
});

/*
 * ─── TIÊM NGƯỢC (đã chạy; số ở báo cáo/commit) ───────────────────────────────────────────────────────────────────────────────
 *  a. thay `<PhongCachKet … gon>` bằng một thanh tĩnh ⇒ I (ô PHONG CÁCH thật) đỏ.         b. thả `trucY` lên mặt ô (bỏ `.gon .trucY {display:none}` + render) ⇒ I (mặt màn) đỏ.
 *  c. gỡ ô LẬT BÀI / BẢN ĐỒ / KHOE / ĐỘI ⇒ I (bốn ô) + II đỏ.                              d. bỏ `NutChinh` ở VỀ SẢNH (onClick thô) ⇒ IV (bấm đúp) đỏ.
 *  e. bỏ effect `data-man-ket` ⇒ IV đỏ.                                                    f. `hang` không lấy từ server (hằng) ⇒ I (hạng) đỏ.
 */
