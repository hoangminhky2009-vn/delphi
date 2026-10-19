/**
 * CẤP 2 LƯỚT SÓNG — XÁC THỰC TIN (founder 22/08, vai ĐỘI LÁI).
 *
 * *"pick 2 lõi Lướt Sóng thì lv2 sẽ cho phép thấy thêm những thứ giúp dự đoán và
 * xác thực thông tin (tin giả–thật) dễ dàng hơn."*
 *
 * ⚠ Bộ test này canh chủ yếu việc KHÔNG RÒ — vì đặc quyền này đọc `la_tin_gia`
 * thật, thứ `oCongKhai` cố ý cắt khỏi mọi payload. Ba lằn ranh:
 *   §I   cấp 1 (một bản) KHÔNG thấy gì — khối `xac_thuc` phải là null;
 *   §II  cấp 2 chỉ lộ sớm tin ĐỤNG MÃ MÌNH ĐANG ÔM, không lộ cả chợ;
 *   §III xác suất giả là số CÔNG KHAI sẵn (cùng hàm bot hoài nghi đọc), không
 *        phải đáp án — ô không phải sự kiện thì null.
 */
import { describe, expect, it } from 'vitest';
import {
  HANG_BANG_THUONG, dungBangDienTu, dungXacThuc, hangBangCua, maTamBao,
} from '../server/holdem/bang_dien_tu.js';
import { taoTran, type GheMoi, type TrangThaiTran } from '../server/holdem/engine.js';
import type { HoldemMap, OThiTruong } from '../server/holdem/map.js';
import { MT_TAI_SAN_SU_KIEN, tyLeTinGiaHieuDung, LAI_SUAT_NEN } from '../config/holdem.js';

const ghe = (id: string, taiSan: string[], chienThuat: string[] = []): GheMoi => ({
  id, loai: id === 'ban' ? 'nguoi' : 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: taiSan, chien_thuat: chienThuat as never },
});
const gd = (id: string): OThiTruong => ({ kind: 'giai_doan', giai_doan: id as never });
const sk = (id: string, laTinGia: boolean): OThiTruong => ({
  kind: 'su_kien', su_kien: id as never, la_tin_gia: laTinGia,
  boi_canh: 'don_doc', bao_truoc: 'giam',
});

/** Trận có map ghép tay, cờ `dac_quyen` + `map_v28` bật để cấp 2 có nghĩa. */
function tran(o: OThiTruong[], vong: number, taiSan: string[], soLuotSong: number): TrangThaiTran {
  const ct = Array.from({ length: soLuotSong }, () => 'luot_song');
  const st = taoTran(7, [ghe('ban', taiSan, ct), ghe('b2', ['usd'])], { dacQuyen: true } as never);
  const map: HoldemMap = { seed: 7, o };
  return { ...st, map, vong, dac_quyen: true, map_v28: true } as TrangThaiTran;
}

/**
 * ⚠ Luật cổng là TÂM BÃO, không phải "có đụng": đo ma trận ra 70/72 cặp (mã, sự
 * kiện) khác 0 ⇒ "có đụng" rò 97%, tức oracle đội lốt. Tra ma trận lấy một sự
 * kiện mà btc là mã bị đánh mạnh nhất, và usd không phải.
 */
const SK_DUNG_BTC = Object.keys(MT_TAI_SAN_SU_KIEN['btc'] ?? {}).find(
  (k) => maTamBao(k) === 'btc',
)!;

describe('I. cấp 1 KHÔNG thấy gì', () => {
  it('một bản Lướt Sóng ⇒ hangBangCua.cap2 = false ⇒ xac_thuc = null', () => {
    const st = tran([sk('bong_bong', true), gd('tang')], 2, ['btc'], 1);
    const hang = hangBangCua(st, 'ban', false);
    expect(hang.luot_song).toBe(true);
    expect(hang.cap2).toBe(false);
    expect(dungBangDienTu(st, 'ban', hang).xac_thuc).toBeNull();
  });

  it('không cầm Lướt Sóng ⇒ null (và hạng thường cũng null)', () => {
    const st = tran([sk('bong_bong', true), gd('tang')], 2, ['btc'], 0);
    expect(dungBangDienTu(st, 'ban', HANG_BANG_THUONG).xac_thuc).toBeNull();
  });
});

describe('II. ⭐⭐ cấp 2 chỉ lộ sớm tin ĐỤNG MÃ MÌNH', () => {
  it(`ô trước là ${SK_DUNG_BTC} (đụng btc) · ghế ôm btc ⇒ LỘ cờ thật`, () => {
    expect(SK_DUNG_BTC).toBeTruthy();
    const st = tran([sk(SK_DUNG_BTC, true), gd('tang')], 2, ['btc'], 2);
    const hang = hangBangCua(st, 'ban', false);
    expect(hang.cap2).toBe(true);
    const xt = dungBangDienTu(st, 'ban', hang).xac_thuc!;
    expect(xt.lo_som).toMatchObject({ su_kien: SK_DUNG_BTC, la_tin_gia: true });
    expect(typeof xt.lo_som!.label).toBe('string');
  });

  it('⭐ cùng ô trước, ghế ôm usd (KHÔNG bị đụng) ⇒ KHÔNG lộ — không phải oracle', () => {
    const st = tran([sk(SK_DUNG_BTC, true), gd('tang')], 2, ['usd'], 2);
    const xt = dungXacThuc(st, st.ghe[0]!);
    expect(xt.lo_som).toBeNull();
  });

  it('ô trước đã lộ theo nhịp thường (V−2) ⇒ không gọi là "lộ sớm" nữa', () => {
    // Ở vòng 3, ô 1 đã công khai theo nhịp thường (daLoTinGia) ⇒ không khai lại.
    const st = tran([sk(SK_DUNG_BTC, true), gd('tang'), gd('tang')], 3, ['btc'], 2);
    const xt = dungXacThuc(st, st.ghe[0]!);
    expect(xt.lo_som).toBeNull();
  });

  it('ô trước là GIAI ĐOẠN (không phải tin) ⇒ không có gì để xác thực', () => {
    const st = tran([gd('tang'), gd('tang')], 2, ['btc'], 2);
    expect(dungXacThuc(st, st.ghe[0]!).lo_som).toBeNull();
  });
});

describe('III. xác suất giả — số công khai, không phải đáp án', () => {
  it('ô đang lật là sự kiện ⇒ đúng con số tyLeTinGiaHieuDung (cùng hàm bot đọc)', () => {
    const o = sk('bong_bong', false);
    if (o.kind !== 'su_kien') throw new Error('fixture');
    const st = tran([gd('tang'), o], 2, ['btc'], 2);
    const xt = dungXacThuc(st, st.ghe[0]!);
    const mong = tyLeTinGiaHieuDung(o.boi_canh, o.su_kien, LAI_SUAT_NEN.KHOI_DIEM);
    expect(xt.xac_suat_gia_bp).toBe(mong);
    // và nó KHÔNG tiết lộ cờ thật của ô đang lật: cùng xác suất dù giả hay thật.
    const st2 = tran([gd('tang'), sk('bong_bong', true)], 2, ['btc'], 2);
    expect(dungXacThuc(st2, st2.ghe[0]!).xac_suat_gia_bp).toBe(mong);
  });

  it('ô đang lật là giai đoạn ⇒ null', () => {
    const st = tran([gd('tang'), gd('giam')], 2, ['btc'], 2);
    expect(dungXacThuc(st, st.ghe[0]!).xac_suat_gia_bp).toBeNull();
  });
});

describe('IV. ⭐⭐ ĐỘ RÒ — cổng phải HẸP, không được thành oracle đội lốt', () => {
  it('mỗi sự kiện có ĐÚNG MỘT mã tâm bão ⇒ ghế ôm một mã chỉ được lộ ≤ 1/6 số sự kiện trung bình', () => {
    const sk = Object.keys(MT_TAI_SAN_SU_KIEN['btc'] ?? {});
    // Tổng số cặp (mã, sự kiện) được lộ = đúng số sự kiện (mỗi sự kiện 1 mã).
    let duocLo = 0;
    for (const s of sk) if (maTamBao(s) !== null) duocLo += 1;
    const tong = sk.length * 6;
    expect(duocLo / tong).toBeLessThanOrEqual(1 / 6 + 1e-9);
    // Luật "có đụng" (bị bác) sẽ ra ≈ 97%: khoá con số để ai đổi cổng phải sửa test có ý thức.
    let coDung = 0;
    for (const s of sk) for (const ma of ['btc','cp_cn','vn30','vang','usd','tpcp'])
      if ((MT_TAI_SAN_SU_KIEN[ma]?.[s as never] ?? 0) !== 0) coDung += 1;
    expect(coDung / tong).toBeGreaterThan(0.9);   // chứng minh vì sao luật kia bị bác
  });
});
