/**
 * K4 — VỊ TRÍ TRONG CHUỖI VĨ MÔ trên bảng điện tử (D164, đợt lật v35).
 *
 * Ranh D154 §7 là LUẬT CỨNG của khối này: bảng bán TÍN HIỆU QUAN SÁT gộp từ
 * thông tin công khai (ô đã lật + mức lãi công bố) — TUYỆT ĐỐI không chở nhãn
 * NGUỒN chuỗi (latent). Bài §III khoá đúng vế đó bằng quét chuỗi hoá cả DTO.
 */
import { describe, expect, it } from 'vitest';
import { dungBangDienTu } from '../server/holdem/bang_dien_tu.js';
import {
  beChuoiCuaLobby, chuoiDangChay, taoTran, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import type { HoldemMap, OThiTruong } from '../server/holdem/map.js';

const ghe = (id: string, taiSan: string[]): GheMoi => ({
  id, loai: id === 'ban' ? 'nguoi' : 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: taiSan, chien_thuat: [] },
});
const gd = (id: string): OThiTruong => ({ kind: 'giai_doan', giai_doan: id as never });
const sk = (id: string, gia = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id as never, la_tin_gia: gia,
  boi_canh: 'don_doc', bao_truoc: 'giam',
});

function tranVoiMap(o: OThiTruong[], vong: number, laiSuatDiem?: number): TrangThaiTran {
  const st = taoTran(7, [ghe('ban', ['btc']), ghe('b2', ['usd'])]);
  const map: HoldemMap = {
    seed: 7, o,
    ...(laiSuatDiem !== undefined
      ? { trang_thai: o.map(() => ({ lai_suat_diem: laiSuatDiem })) as never }
      : {}),
  };
  return { ...st, map, vong };
}

describe('I. Con số gộp đúng — và MỘT nguồn với máy bẻ-chuỗi', () => {
  it('⭐ chuỗi giảm 2 ô đã lật ⇒ {xuong, 2}; run không reset qua ô sự kiện', () => {
    const st = tranVoiMap([gd('giam'), sk('lam_phat'), gd('giam'), gd('tang')], 4);
    const b = dungBangDienTu(st);
    expect(b.chuoi_vi_mo).toMatchObject({ huong: 'xuong', dai: 2 });
  });

  it('vòng 1 (chưa ô pha nào lật) ⇒ null, không bịa số', () => {
    expect(dungBangDienTu(tranVoiMap([gd('tang'), gd('tang')], 1)).chuoi_vi_mo).toBeNull();
  });

  it('môi trường đọc từ mức lãi ĐÃ CÔNG BỐ (trang_thai); map cũ không có ⇒ trung tính khởi điểm', () => {
    const co = dungBangDienTu(tranVoiMap([gd('tang'), gd('tang'), gd('giam')], 3, 0));
    expect(co.chuoi_vi_mo?.moi_truong).toBe('re');
    const khong = dungBangDienTu(tranVoiMap([gd('tang'), gd('tang'), gd('giam')], 3));
    expect(khong.chuoi_vi_mo?.moi_truong).toBe('trung_tinh');
  });

  it('⭐ bảng và máy bẻ-chuỗi đếm CÙNG một run — chuoiDangChay là một nguồn', () => {
    /*
     * Không so hành vi hai máy (điều kiện bẻ-chuỗi còn vế vốn/môi trường) —
     * so CON SỐ RUN: helper trả gì thì bảng phải in đúng nấy, và
     * beChuoiCuaLobby phải đọc qua helper (quét nguồn dưới). Hai bản đếm là
     * hai bản sẽ trôi (D61), cú trôi ở đây là bảng bán số khác số máy dùng.
     */
    const o = [gd('giam'), gd('giam'), sk('lam_phat'), gd('giam'), gd('tang')];
    const c = chuoiDangChay(o, 5);
    expect(c).toEqual({ huong: -1, dai: 3 });
    expect(dungBangDienTu(tranVoiMap(o, 5)).chuoi_vi_mo)
      .toMatchObject({ huong: 'xuong', dai: 3 });
  });
});

describe('II. Dây nối một nguồn', () => {
  it('beChuoiCuaLobby đọc run qua chuoiDangChay — không giữ vòng đếm riêng', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(process.cwd(), 'server/holdem/engine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');
    const than = src.split('export function beChuoiCuaLobby')[1]!
      .split('export function')[0]!;
    expect(than, 'beChuoiCuaLobby phải gọi helper chung').toContain('chuoiDangChay(');
    expect(than, 'còn vòng đếm run chép tay — bản sao sẽ trôi')
      .not.toContain('HUONG_GIAI_DOAN');
  });
});

describe('III. ⭐⭐ Ranh latent — DTO không chở nhãn nguồn chuỗi (D154 §7)', () => {
  it('chuỗi hoá TRỌN bảng: không một chữ tien_re/tin_don/chinh_sach_that/hoang_loan', () => {
    /*
     * Quét cả DTO chứ không quét riêng trường mới: nhãn nguồn mà rò thì có
     * thể rò qua BẤT KỲ trường nào thêm sau này — bài này là hàng rào của cả
     * bảng, không phải của một field.
     */
    const st = tranVoiMap(
      [sk('ha_lai_suat'), gd('tang'), gd('tang'), sk('lam_phat', true), gd('giam')], 5, 0);
    const chu = JSON.stringify(dungBangDienTu(st));
    for (const nhan of ['tien_re', 'tin_don', 'chinh_sach_that', 'hoang_loan']) {
      expect(chu, `bảng điện tử rò nhãn nguồn "${nhan}" — latent thủng`).not.toContain(nhan);
    }
  });

  it('helper chỉ đọc ô ĐÃ LẬT — ô tương lai không rò vào con số', () => {
    const o = [gd('giam'), gd('giam'), gd('tang'), gd('tang'), gd('tang')];
    expect(chuoiDangChay(o, 3)).toEqual({ huong: -1, dai: 2 });
    // beChuoiCuaLobby cùng ranh (cùng helper) — đổi vongMoi là đổi con số.
    const st = { ...tranVoiMap(o, 3), be_chuoi_von: true } as TrangThaiTran;
    void beChuoiCuaLobby(st, 3); // không nổ vì thiếu vốn/môi trường — chỉ cần không đọc ô 3+
    expect(chuoiDangChay(o, 6)).toEqual({ huong: 1, dai: 3 });
  });
});
