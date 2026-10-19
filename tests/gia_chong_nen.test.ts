/**
 * v36 R2 BẢN C (D172, founder chốt "C đi") — NỀN **NHÂN** VÀO LỰC TIN.
 *
 * Bản CỘNG (D166) đẻ một thành phần CHUNG không phụ thuộc tin thật/giả ⇒ pha
 * loãng đúng tín hiệu bot hoài-nghi sống nhờ, G4 đổ ở map dài, và hạ số KHÔNG
 * cứu (15% ✗ · 8% ✗ · 0% ✓ — không đơn điệu, D171). Bản C: tin vẫn là toàn bộ
 * lực của vòng, nền chỉ quyết định nó ĐẬM hay NHẠT — vẫn đúng addendum §1
 * ("tin sửa ĐIỀU KIỆN"), không đẻ thành phần chung, và thưởng người đọc CẢ HAI.
 *
 *   §I   CỔNG — false mọi entry trừ v36; cờ tắt ⇒ giá y hệt v35 từng bp.
 *   §II  ⭐⭐ NHÂN, KHÔNG CỘNG — bài chịu lực: tin trung tính thì nền KHÔNG tự
 *        sinh lãi/lỗ; cùng một tin thì thuận > ngang > ngược.
 *   §III Vòng PHA bất động · tin GIẢ nhân rồi mới đảo · map cũ không vỡ.
 *   §IV  BOT đọc CÙNG hàm engine dùng (một nguồn, D61).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BO_LUAT_THEO_PHIEN_BAN, REGIME_TICK, luatCua } from '../config/holdem.js';
import {
  dungChuoi, heSoTinTheoNenThuan, taoTran, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { loiSuatKyVongBp, timBot } from '../server/holdem/bots.js';
import { THU_TU_MA_SUC_CANG, type HoldemMap, type OThiTruong } from '../server/holdem/map.js';

const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: ['btc'], chien_thuat: [] },
});
const gd = (g: string): OThiTruong => ({ kind: 'giai_doan', giai_doan: g as never });
/** Ô tin — `baoTruoc` là nhãn CÔNG KHAI quyết định thuận/ngược nền. */
const sk = (id: string, baoTruoc = 'tang', gia = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id as never, la_tin_gia: gia,
  boi_canh: 'don_doc', bao_truoc: baoTruoc as never,
});

function tran(o: OThiTruong[], vong: number, nen: string,
  luat = 'balance-v36-regime'): TrangThaiTran {
  const st = taoTran(11, [ghe('a'), ghe('b')], luatCua(luat), 8);
  const map: HoldemMap = {
    seed: 11, o,
    // `suc_cang_bp` BẮT BUỘC có — `sucCangLuc` đọc thẳng theo chỉ số mã.
    trang_thai: o.map(() => ({
      giai_doan_nen: nen, suc_cang_bp: THU_TU_MA_SUC_CANG.map(() => 0),
    })) as never,
  };
  return { ...st, map, vong };
}

/** PnL của ghế 'a' ở vòng `vong`, bật/tắt cờ. */
const pnl = (st: TrangThaiTran, o: OThiTruong, bat: boolean): number =>
  dungChuoi({ ...st, gia_chong_nen: bat }, st.ghe[0]!, o).pnl_bp;

describe('I. Cổng', () => {
  it('⭐⭐ giaChongNen = false ở TỪNG entry trừ v36', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      /*
       * ⚠ THƯỚC ĐÚNG LÀ "KHÔNG BẬT HỒI TỐ", KHÔNG PHẢI "CHỈ MỘT PHIÊN BẢN".
       * Bản đầu chốt `=== 'balance-v36-regime'`, nên MỖI LẦN thêm một
       * phiên bản kế thừa (v37…) là bài này đỏ dù không có gì hỏng — mà một bài
       * đỏ vì lý do sai thì sẽ bị nới bừa cho qua (D79). Điều thật sự phải giữ:
       * phiên bản CŨ HƠN mốc không bao giờ được bật, vì đó mới là cú đổi
       * replay của trận đã lưu.
       */
      const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
      const moc = soCua('balance-v36-regime');
      if (soCua(ten) < moc) {
        expect(luat.giaChongNen, `phiên bản CŨ "${ten}" bật cờ ⇒ đổi map trận đã lưu`)
          .not.toBe(true);
      } else {
        expect(luat.giaChongNen, `phiên bản "${ten}" từ mốc trở đi phải bật`).toBe(true);
      }
    }
    expect(luatCua('phien-ban-khong-ton-tai').giaChongNen).toBe(false);
  });

  it('⭐ cờ TẮT ⇒ giá vòng tin y hệt v35 từng bp', () => {
    const o = [gd('tang'), sk('bong_bong'), gd('tang')];
    const st = tran(o, 2, 'tang');
    expect(pnl(st, o[1]!, false))
      .toBe(pnl(tran(o, 2, 'tang', 'balance-v35-chuoi'), o[1]!, false));
  });
});

describe('II. ⭐⭐ NHÂN, không CỘNG — gốc bệnh của bản D166', () => {
  it('⭐⭐ tin TRUNG TÍNH (bao_truoc đi ngang): nền KHÔNG tự sinh lãi/lỗ nào', () => {
    /*
     * BÀI CHỊU LỰC của cả bản C. Bản CỘNG cũ: nền `tang` ⇒ btc được +bp DÙ tin
     * chẳng nghiêng bên nào — đó chính là "thành phần chung" pha loãng G4.
     * Bản NHÂN: không có gì để nhân thì không có gì đổi.
     */
    const o = [gd('tang'), sk('hack_san', 'di_ngang'), gd('tang')];
    for (const nen of ['tang', 'giam', 'di_ngang']) {
      const st = tran(o, 2, nen);
      expect(pnl(st, o[1]!, true), `nền ${nen} tự đẻ lãi/lỗ — lại là thành phần chung`)
        .toBe(pnl(st, o[1]!, false));
    }
  });

  it('⭐⭐ cùng một tin: THUẬN nền đậm hơn, NGƯỢC nền nhạt hơn', () => {
    const o = [gd('tang'), sk('bong_bong', 'tang'), gd('tang')];
    const thuan = pnl(tran(o, 2, 'tang'), o[1]!, true);
    const ngang = pnl(tran(o, 2, 'di_ngang'), o[1]!, true);
    const nguoc = pnl(tran(o, 2, 'giam'), o[1]!, true);
    // btc ăn bong bóng (+) nên thuận > ngang > ngược.
    expect(thuan).toBeGreaterThan(ngang);
    expect(nguoc).toBeLessThan(ngang);
    // Nền NGANG = không nhân gì — bằng đúng cờ tắt.
    expect(ngang).toBe(pnl(tran(o, 2, 'di_ngang'), o[1]!, false));
  });

  it('hệ số thuần: thuận/ngược/trung tính đúng hằng, đối xứng hai chiều', () => {
    expect(heSoTinTheoNenThuan('tang', 'tang')).toBe(REGIME_TICK.TIN_THUAN_NEN_X_BP);
    expect(heSoTinTheoNenThuan('giam', 'giam')).toBe(REGIME_TICK.TIN_THUAN_NEN_X_BP);
    expect(heSoTinTheoNenThuan('tang', 'giam')).toBe(REGIME_TICK.TIN_NGUOC_NEN_X_BP);
    expect(heSoTinTheoNenThuan('giam', 'tang')).toBe(REGIME_TICK.TIN_NGUOC_NEN_X_BP);
    expect(heSoTinTheoNenThuan('di_ngang', 'tang')).toBe(10000);
    expect(heSoTinTheoNenThuan('tang', 'di_ngang')).toBe(10000);
    // `phuc_hoi` là mặt HƯỚNG LÊN — nền phục hồi phải thuận tin tăng.
    expect(heSoTinTheoNenThuan('phuc_hoi', 'tang')).toBe(REGIME_TICK.TIN_THUAN_NEN_X_BP);
  });
});

describe('III. Ranh giới', () => {
  it('⭐ vòng PHA bất động — mặt ô đã là nền, nhân nữa là đếm đôi', () => {
    const o = [gd('tang'), gd('giam'), gd('tang')];
    for (const v of [1, 2, 3]) {
      const st = tran(o, v, 'giam');
      expect(pnl(st, o[v - 1]!, true)).toBe(pnl(st, o[v - 1]!, false));
    }
  });

  it('⭐ tin GIẢ: NHÂN theo mặt chữ rồi mới ĐẢO — nói dối to giữa chợ thuận trả giá to', () => {
    const oThat = [gd('tang'), sk('bong_bong', 'tang'), gd('tang')];
    const oGia = [gd('tang'), sk('bong_bong', 'tang', true), gd('tang')];
    const that = pnl(tran(oThat, 2, 'tang'), oThat[1]!, true);
    const gia = pnl(tran(oGia, 2, 'tang'), oGia[1]!, true);
    expect(that).toBeGreaterThan(0);
    expect(gia).toBeLessThan(0);
    expect(gia, 'tin giả thuận nền phải lỗ ĐẬM HƠN tin giả giữa nền ngang')
      .toBeLessThan(pnl(tran(oGia, 2, 'di_ngang'), oGia[1]!, true));
  });

  it('map cũ không có `trang_thai` ⇒ không nhân gì, không vỡ', () => {
    const o = [gd('tang'), sk('bong_bong'), gd('tang')];
    const st = tran(o, 2, 'tang');
    const khongTt = { ...st, suc_cang: false, map: { seed: 11, o } } as TrangThaiTran;
    expect(pnl(khongTt, o[1]!, true)).toBe(pnl(khongTt, o[1]!, false));
  });
});

describe('IV. BOT đọc CÙNG hàm engine dùng', () => {
  it('⭐⭐ điểm mã của bot nhân đúng hệ số nền; vắng `nen` ⇒ y như v35', () => {
    // ⚠ Phải là bot ĐỌC TIN: `tat_tay` có hệ số tin = 0 nên nhân gì cũng ra 0
    // — bài bản đầu dùng nó và đỏ với "-350 to be greater than -350".
    const bot = timBot('tin_moi_tin')!;
    const bcGoc = {
      o: sk('bong_bong', 'tang'),
      echo: [] as readonly { su_kien: string; do_lon_bp: number; dao: boolean }[],
    };
    const khong = loiSuatKyVongBp('btc', bot, bcGoc as never);
    expect(loiSuatKyVongBp('btc', bot, { ...bcGoc, nen: 'tang' } as never))
      .toBeGreaterThan(khong);
    expect(loiSuatKyVongBp('btc', bot, { ...bcGoc, nen: 'giam' } as never))
      .toBeLessThan(khong);
    expect(loiSuatKyVongBp('btc', bot, { ...bcGoc, nen: 'di_ngang' } as never))
      .toBe(khong);
    // Tin trung tính ⇒ bot cũng không đổi điểm dù nền nghiêng.
    const trungTinh = { ...bcGoc, o: sk('hack_san', 'di_ngang') };
    expect(loiSuatKyVongBp('btc', bot, { ...trungTinh, nen: 'tang' } as never))
      .toBe(loiSuatKyVongBp('btc', bot, trungTinh as never));
  });

  it('⭐ nhịp lệnh cấp `nen` cho MỌI vòng tin — lọc sớm là bot thấy khác engine', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'server/holdem/nhip_lenh_bot.ts'), 'utf8');
    expect(src).toContain('gia_chong_nen');
    expect(src).toContain('giai_doan_nen');
    // Không tự lọc nền ngang ở tầng cấp bối cảnh (hệ số tự trả 10000).
    expect(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))
      .not.toMatch(/nen[A-Za-z]*\s*!==\s*'di_ngang'/);
  });
});
