/**
 * D533 — LUỒNG NGƯỜI CHƠI (founder 06/10, ảnh vòng 1: *"bấm không roll lại lõi"*; *"pick lõi xong thì không cho chơi mini game, xong thì khoá hết
 * nút"*; *"bỏ cái nút Màn vòng 1 … mini game tự động mở"*). Dựng lại trên trình duyệt + server thật ra BA lỗi xích nhau:
 *   1. đổi lõi ở vòng 1 không hiện (trạng thái cục bộ còn null) mà vẫn tính lượt ⇒ lõi chọn từ quầy cũ bị server bỏ qua ⇒ màn "chỉ xem";
 *   2. đóng màn hỏi lại bằng `refetch` ⇒ không đè trạng thái cục bộ ⇒ bàn kẹt ở vòng vừa nộp, CHỐT mờ, vòng sau bị chốt hộ;
 *   3. lệnh bị bác ở vòng có màn không có lý do nào tới màn (Tổ Chức bấm 50 % một mã là dính).
 *
 *   §I   quầy đã đổi đè lên mọi trạng thái cùng vòng (`apQuayDoi`)
 *   §II  hẹn hỏi lại khi chờ màn + tự thử lại mở màn
 *   §III dây nối ở màn trận (quét mã nguồn — cùng nếp `v57_khung_tran_ui`)
 *   §IV  shop chặn TRƯỚC lệnh làm cả chuỗi bị bác
 *   §V   đầu màn vòng cuối không ghi "VÒNG 8/7"
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

vi.mock('@/lib/telemetry', () => ({ ghiDo: () => {} }));

import { apQuayDoi, choHoiLai, CHO_MAN_MAC_DINH_MS, CHO_MAN_TOI_THIEU_MS, mocHetMan, nenThuLaiMoMan } from '../src/lib/cho_man';
import { ShopManHinh } from '../src/components/holdem/ShopManHinh';

const doc = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('§I — quầy đã đổi', () => {
  const st = { vong: 1, shop: { chien_thuat: ['bat_day', 'ban_khong'] }, ban: { luot_khao_sat: 2, von: 10000 } };
  const q = { vong: 1, shop: { chien_thuat: ['mua_duoi', 'don_bay'] }, luot: 1 };
  it('⭐ cùng vòng ⇒ quầy + ví của cú đổi đè lên trạng thái (GET luôn bày quầy lượt 0); phần khác giữ nguyên', () => {
    const ra = apQuayDoi(st, q);
    expect(ra.shop).toEqual(q.shop);
    expect(ra.ban).toEqual({ luot_khao_sat: 1, von: 10000 });
    expect(st.shop.chien_thuat, 'không sửa tại chỗ').toEqual(['bat_day', 'ban_khong']);
  });
  it('vòng đã tiến · chưa đổi ⇒ trả nguyên', () => {
    expect(apQuayDoi({ ...st, vong: 2 }, q).shop).toEqual(st.shop);
    expect(apQuayDoi(st, null)).toBe(st);
  });
});

describe('§II — hẹn hỏi lại khi chờ màn', () => {
  it('⭐ mốc hết màn đóng dấu lúc nhận; hỏi lại sau mốc + đệm, không dưới mức tối thiểu', () => {
    expect(mocHetMan(49000, 1000)).toBe(50000);
    expect(choHoiLai(50000, 1000)).toBe(49800);
    expect(choHoiLai(50000, 49900), 'server lệch vài trăm ms ⇒ không hỏi dồn').toBe(CHO_MAN_TOI_THIEU_MS);
  });
  it('server không báo mốc ⇒ hỏi lại định kỳ', () => {
    expect(mocHetMan(undefined, 1000)).toBe(1000 + CHO_MAN_MAC_DINH_MS);
    expect(mocHetMan(Number.NaN, 0)).toBe(CHO_MAN_MAC_DINH_MS);
  });
  it('mở màn hỏng: rớt mạng / 5xx ⇒ thử lại; lỗi nghiệp vụ ⇒ thôi', () => {
    expect([0, 502, undefined].map(nenThuLaiMoMan)).toEqual([true, true, true]);
    expect([409, 403, 404].map(nenThuLaiMoMan)).toEqual([false, false, false]);
  });
});

describe('§III — dây nối ở màn trận', () => {
  const MAN = doc('src/screens/holdem/AlphaDraftMatch.tsx');
  it('⭐ đóng màn = ĐỒNG BỘ LẠI (đè trạng thái cục bộ), không `tt.refetch()`', () => {
    expect(MAN).toMatch(/dong=\{\(\) => \{ setManVong\(null\); void dongBoLaiTuServerRef\.current\(\); \}\}/);
    expect(MAN).not.toMatch(/dong=\{\(\) => \{ setManVong\(null\); void tt\.refetch\(\); \}\}/);
  });
  it('⭐ không còn nút "▶ MÀN VÒNG" (founder: màn tự mở); chờ màn thì có dòng NÓI + hẹn hỏi lại', () => {
    expect(MAN, 'JSX nút cũ').not.toMatch(/▶ MÀN VÒNG \{/);
    expect(MAN).not.toMatch(/manSan/);
    expect(MAN).toMatch(/<ChoManDong moc=\{choManMoc\.current\.moc\}/);
    expect(MAN).toMatch(/choHoiLai\(choManMoc\.current\.moc, Date\.now\(\)\)/);
  });
  it('⭐ đổi lõi dựng từ bản ĐANG VẼ khi chưa có trạng thái cục bộ; đồng bộ lại cùng vòng giữ quầy đã đổi', () => {
    expect(MAN).toMatch(/const goc = cu \?\? tt\.data \?\? null; return goc \? apQuayDoi\(goc, quayDoi\.current\) : goc;/);
    expect(MAN).toMatch(/setSt\(apQuayDoi\(kemLoiVon, quayDoi\.current\)\)/);
  });
  it('shop không tự mở lại khi đang chờ màn (trạng thái là của vòng vừa chốt)', () => {
    expect(MAN).toMatch(/tuTheBan === 'all_in' \|\| dangChoMan\) return;/);
  });
});

describe('§IV — shop chặn TRƯỚC lệnh làm cả chuỗi bị bác', () => {
  const TAI_SAN = [
    { id: 'btc', ten: 'Crypto', mau: ['#f7931a', 'rgba(247,147,26,.22)'] as const },
    { id: 'vang', ten: 'Vàng', mau: ['#fbbf24', 'rgba(251,191,36,.22)'] as const },
  ];
  const dung = (mandate: boolean) => {
    const onThem = vi.fn();
    render(
      <ShopManHinh
        vong={3} loaiVongNay="tai_san" vongMoTiepTheo={{ tai_san: null, chien_thuat: null }}
        taiSan={TAI_SAN} chienThuat={[]} chonTS={['btc']} chonCT={null}
        onChonTS={() => {}} onChonCT={() => {}}
        danhMuc={[]} sucChuaTaiSan={4} sucChuaChienThuat={3} art={{}}
        ganVao={null} onGan={() => {}} phamViThe={() => 'danh_muc'}
        doiGan={{}} onDoiGan={() => {}}
        chiPhiRoll={1} luotConLai={1} onRoll={() => {}} onDong={() => {}} onChotVong={() => {}}
        tuDien={{ tai_san: {}, chien_thuat: {}, muc: [] } as never}
        giaiDoanNhan={[]} suKienNhan={[]} moTaChienThuat={() => undefined}
        {...(mandate ? { vai: { id: 'to_chuc', ten: 'TỔ CHỨC', dacQuyen: '', caiGia: '', mandate: { tran_ma_bp: 4000, cam_khong: true } } } : {})}
        nav={{ tienMat: 20000, viThe: {}, viKhong: {}, coBanKhong: false, buocMocBp: 2500, lenh: [], onThem, onXoa: () => {}, startVon: 20000, lenhTruoc: [] }}
      />,
    );
    return onThem;
  };
  // D540 — chạm Crypto rồi chạm chip trên PHIẾU LỆNH (thẻ đang chọn sẵn — `chonTS` của cha).
  const datLenh = (moc: number) => {
    fireEvent.click(document.querySelector(`[data-phieu-lenh] [data-moc="${moc}"]`)!);
  };
  it('⭐ Tổ Chức bấm 50 % một mã ⇒ KHÔNG xếp, nói lý do (trước: lọt vào hàng, chốt xong cả chuỗi bị bác, không màn)', () => {
    const onThem = dung(true);
    datLenh(5000);
    expect(onThem).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('VAI TỔ CHỨC');
  });
  it('vế ngược: Tổ Chức 25 % ⇒ xếp; người không mandate 50 % ⇒ xếp', () => {
    const a = dung(true);
    datLenh(2500);
    expect(a).toHaveBeenCalledWith({ ma: 'btc', chieu: 'mua', moc_bp: 2500 });
    document.body.innerHTML = '';
    const b = dung(false);
    datLenh(5000);
    expect(b).toHaveBeenCalledWith({ ma: 'btc', chieu: 'mua', moc_bp: 5000 });
  });
});

describe('§V — đầu màn vòng cuối', () => {
  it('vòng hiện trên đầu màn chặn trên ở tổng số vòng (màn vòng 7/7 từng ghi "VÒNG 8/7")', () => {
    expect(doc('src/components/holdem/ManMinigame.tsx')).toMatch(/VÒNG \{tongVong \? Math\.min\(vong \+ 1, tongVong\) : vong \+ 1\}/);
  });
});
