/**
 * B2 — BÀI QUÉT MÃ NGUỒN cho cổng cửa tiêu T.
 *
 * Bài này KHÔNG kiểm một hành vi. Nó kiểm rằng **một cửa tiêu T mới không ra đời
 * im lặng được**: thêm một tệp `server/` ghi `wallet_ledger` mà chưa khai vào
 * `SO_DANG_KY_CUA_CHAM_VI` ⇒ đỏ, kèm đúng tên tệp còn thiếu.
 *
 * Vì sao cần: cổng hiện tại nằm trong `shop_kho.ts` và CHỈ gacha đi qua. D246
 * §10.2 đã chỉ ra rằng ống dẫn "trợ cấp → lò đốt" mà D245 lo **chưa tồn tại**,
 * nhưng mỗi cửa tiêu T mới có thể mở nó. Một dòng dặn dò trong tài liệu không
 * chặn được điều đó; một bài test đỏ thì có.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECONOMY } from '../config/economy.js';
import {
  QUET_BO_QUA, SO_DANG_KY_CUA_CHAM_VI, SO_DANG_KY_SO_SANH_NGUONG,
  conTrenLuoiSauKhiChi, lyDoTuChoiTieuT,
} from '../server/kinh_te/cua_tieu.js';
import { duDieuKienMoHop } from '../server/shop_kho.js';
import { GACHA } from '../server/sandbox/gacha.js';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function quetTep(thuMuc: string, ra: string[] = []): string[] {
  for (const ten of readdirSync(thuMuc)) {
    const duong = path.join(thuMuc, ten);
    if (statSync(duong).isDirectory()) quetTep(duong, ra);
    else if (ten.endsWith('.ts')) ra.push(duong);
  }
  return ra;
}

describe('Cổng cửa tiêu T — phép tính', () => {
  it('sau khi chi phải CÒN TRÊN ngưỡng, không phải "còn đúng bằng"', () => {
    const n = BigInt(ECONOMY.SUBSIDY_THRESHOLD);
    expect(conTrenLuoiSauKhiChi(n + 100n, 100n)).toBe(true);   // còn đúng ngưỡng ⇒ qua
    expect(conTrenLuoiSauKhiChi(n + 99n, 100n)).toBe(false);   // hụt 1 ⇒ chặn
    expect(conTrenLuoiSauKhiChi(n, 0n)).toBe(true);
    expect(conTrenLuoiSauKhiChi(0n, 0n)).toBe(false);
  });

  it('từ chối đầu vào âm — sổ không có khái niệm chi âm', () => {
    expect(() => conTrenLuoiSauKhiChi(-1n, 0n)).toThrow();
    expect(() => conTrenLuoiSauKhiChi(0n, -1n)).toThrow();
  });

  it('⚠ HÀNH VI GACHA KHÔNG ĐỔI sau khi dời phép tính (B2 không sửa gì cả)', () => {
    // Ba mốc chép từ D246 §10.2: cần ≥600 T mới quay, quay xong còn ≥500 T.
    expect(duDieuKienMoHop(600n, GACHA.COST_T)).toBe(true);
    expect(duDieuKienMoHop(599n, GACHA.COST_T)).toBe(false);
    expect(duDieuKienMoHop(550n, GACHA.COST_T)).toBe(false);
    // Và đúng bằng cổng dùng chung — hai đường không được phép lệch nhau.
    for (const v of [0n, 499n, 500n, 550n, 599n, 600n, 601n, 10_000n]) {
      expect(duDieuKienMoHop(v, GACHA.COST_T))
        .toBe(conTrenLuoiSauKhiChi(v, BigInt(GACHA.COST_T)));
    }
  });

  it('⚠ vòng lặp D245 lo KHÔNG chạy được: ở 550 T thì quay bị từ chối', () => {
    // 550 − 100 = 450 < 500 ⇒ chặn. Người quay không bao giờ tự đưa mình xuống
    // dưới ngưỡng trợ cấp, nên gacha không phải một ống dẫn Kho bạc → lò đốt.
    expect(conTrenLuoiSauKhiChi(550n, BigInt(GACHA.COST_T))).toBe(false);
    // Và mốc thấp nhất quay được để lại đúng ngưỡng, không thấp hơn.
    expect(600n - BigInt(GACHA.COST_T)).toBe(BigInt(ECONOMY.SUBSIDY_THRESHOLD));
  });

  it('câu từ chối nói ra CẢ ngưỡng lẫn số bị trừ', () => {
    const s = lyDoTuChoiTieuT(100n);
    expect(s).toContain(String(ECONOMY.SUBSIDY_THRESHOLD));
    expect(s).toContain('100');
  });
});

describe('⚠ QUÉT MÃ NGUỒN — cửa chạm ví phải được KHAI, không được lặng lẽ mọc', () => {
  const boQua = QUET_BO_QUA.map((x) => x.tep);
  const tepChamVi = quetTep(path.join(GOC, 'server'))
    .filter((d) => readFileSync(d, 'utf8').includes('INSERT INTO wallet_ledger'))
    .map((d) => path.relative(GOC, d).split(path.sep).join('/'))
    .filter((t) => !boQua.includes(t))
    .sort();

  it('mọi tệp ghi wallet_ledger đều có trong sổ đăng ký', () => {
    const daKhai = SO_DANG_KY_CUA_CHAM_VI.map((c) => c.tep).sort();
    const thieu = tepChamVi.filter((t) => !daKhai.includes(t));
    expect(thieu, `Tệp ghi wallet_ledger mà CHƯA KHAI trong SO_DANG_KY_CUA_CHAM_VI: `
      + `${thieu.join(', ')}. Thêm một dòng vào server/kinh_te/cua_tieu.ts và nói rõ `
      + `cửa này có cần cổng tiêu T không, vì sao.`).toEqual([]);
  });

  it('sổ đăng ký không có tệp ma — khai rồi mà tệp thôi chạm ví thì phải dọn', () => {
    const thua = SO_DANG_KY_CUA_CHAM_VI.map((c) => c.tep).filter((t) => !tepChamVi.includes(t));
    expect(thua, `Khai trong sổ nhưng tệp không còn ghi wallet_ledger: ${thua.join(', ')}`)
      .toEqual([]);
  });

  it('MIỄN TRỪ phải có lý do đọc được — không được là một ô để trống', () => {
    for (const c of SO_DANG_KY_CUA_CHAM_VI) {
      expect(c.viSao.length, `${c.tep} thiếu lý do`).toBeGreaterThan(30);
    }
  });

  it('cửa nào khai CẦN CỔNG thì phải thật sự gọi cổng — và danh sách là ĐÓNG', () => {
    /*
     * Hai vế, và vế thứ hai mới là vế khó bỏ qua: (1) khai `canCong: true` mà
     * không gọi cổng là một lời hứa suông; (2) danh sách chốt cứng ở đây để một
     * cửa **rút** khỏi cổng cũng phải đi qua một lần sửa test có chủ ý — hạ một
     * cửa xuống `false` là nới một luật về tiền, không phải dọn dẹp.
     */
    /*
     * ⚠ ĐO ĐƯỢC GIỚI HẠN CỦA CHÍNH BÀI NÀY (tiêm lỗi 06/09): bỏ hẳn lời gọi cổng
     * ở đường MUA của `cho.ts` mà bài này **vẫn xanh**, vì route `/cho/quay`
     * cũng gọi cổng để tính cờ `mo`. Bài quét theo TỆP chỉ trả lời được "tệp này
     * có biết tới cổng không", không trả lời được "đường tiêu tiền có đi qua cổng
     * không". Người canh câu thứ hai là `tests/cho_mua.test.ts` (ví sát ngưỡng ⇒
     * 409), và nó ĐÃ đỏ đúng lúc tiêm. Ghi ra để không ai đọc bài này rộng hơn
     * thực tế của nó.
     */
    const canCong = SO_DANG_KY_CUA_CHAM_VI.filter((c) => c.canCong).map((c) => c.tep).sort();
    expect(canCong).toEqual(['server/cho.ts', 'server/shop_kho.ts']);
    for (const tep of canCong) {
      const nguon = readFileSync(path.join(GOC, tep), 'utf8')
        .split('\n').filter((d) => !/^\s*(import|\s*\})/.test(d)).join('\n');
      expect(nguon, `${tep} khai canCong nhưng không gọi cổng ở thân hàm`)
        .toContain('conTrenLuoiSauKhiChi(');
    }
  });

  it('nơi so với SUBSIDY_THRESHOLD là một danh sách ĐÓNG', () => {
    /*
     * Ngưỡng này trả lời HAI câu ngược chiều nhau — "được NHẬN không" (subsidy)
     * và "được CHI không" (cua_tieu). Cả hai đều hợp lệ, nên bài quét không cấm
     * mà KHOÁ DANH SÁCH: một cửa thứ ba chép phép so đó ⇒ đỏ, và người viết
     * phải nói rõ mình đang hỏi câu nào.
     */
    const pham = quetTep(path.join(GOC, 'server'))
      .filter((d) => {
        const t = readFileSync(d, 'utf8');
        return t.includes('>= BigInt(ECONOMY.SUBSIDY_THRESHOLD)')
          || t.includes('>= ECONOMY.SUBSIDY_THRESHOLD');
      })
      .map((d) => path.relative(GOC, d).split(path.sep).join('/'))
      .sort();
    expect(pham).toEqual(SO_DANG_KY_SO_SANH_NGUONG.map((x) => x.tep).sort());
  });

  it('mỗi nơi so ngưỡng phải khai RÕ mình hỏi câu nào', () => {
    for (const x of SO_DANG_KY_SO_SANH_NGUONG) {
      expect(x.hoi, `${x.tep} chưa nói rõ hỏi câu gì`).toMatch(/NHẬN|CHI/);
    }
  });

  it('danh sách bỏ qua phải NGẮN và mỗi dòng tự bào chữa được', () => {
    expect(QUET_BO_QUA.length).toBeLessThanOrEqual(2);
    for (const x of QUET_BO_QUA) expect(x.viSao.length).toBeGreaterThan(30);
  });
});
