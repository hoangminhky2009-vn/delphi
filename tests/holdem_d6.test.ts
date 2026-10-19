/**
 * D6 — KHẨU VỊ RỦI RO: kỳ vọng KHÔNG đổi, chỉ phương sai đổi.
 *
 * Vế thứ hai của chỉ đạo founder 25/07 ("mức độ chịu rủi ro khác nhau").
 *
 * BẤT BIẾN CHỊU LỰC — NHÂN CẢ HAI CHIỀU. Nếu "quyết liệt" ăn đậm hơn mà thua nhẹ
 * hơn thì nó không phải khẩu vị, nó là nút-bấm-là-đúng: mọi người chọn nó, và ta
 * lại rơi vào vòng vặn số mà chỉ đạo bảo bỏ. Quan trọng hơn, lệch kỳ vọng làm BẨN
 * phép đo khẩu vị — khi hai lựa chọn cùng kỳ vọng thì thứ duy nhất quyết định là
 * người chơi chịu được bao nhiêu biến động, và đó chính là tín hiệu hành vi mà app
 * muốn bán (A1).
 */
import { describe, expect, it } from 'vitest';
import { dungChuoi, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { KHAU_VI, KHAU_VI_MAC_DINH, khauViCua, type ChienThuatId } from '../config/holdem.js';

const ghe = (id: string, ts: string[], kv?: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: ts, chien_thuat: [] as ChienThuatId[] },
  ...(kv ? { khau_vi: kv as never } : {}),
});

/** PnL của ghế 0 qua nhiều seed/vòng, với một khẩu vị cho trước. */
function chuoiPnl(kv?: string): number[] {
  const out: number[] = [];
  for (let seed = 1; seed < 30; seed += 1) {
    const st = taoTran(seed, [
      ghe('a', ['btc', 'vang'], kv), ghe('b', ['usd']), ghe('c', ['cp_cn'])]);
    for (let v = 1; v <= st.map.o.length; v += 1) {
      out.push(dungChuoi({ ...st, vong: v }, st.ghe[0]!, st.map.o[v - 1]!).pnl_bp);
    }
  }
  return out;
}

describe('D6 — hệ số nhân CẢ HAI CHIỀU', () => {
  it('quyết liệt nhân TO cả lãi lẫn lỗ, thận trọng nhân NHỎ cả hai', () => {
    const nen = chuoiPnl('can_bang');
    const to = chuoiPnl('quyet_liet');
    const nho = chuoiPnl('than_trong');

    let daKiemLai = 0; let daKiemLo = 0;
    for (let i = 0; i < nen.length; i += 1) {
      if (nen[i]! > 0) {
        daKiemLai += 1;
        expect(to[i]!, 'lãi phải to hơn khi quyết liệt').toBeGreaterThanOrEqual(nen[i]!);
        expect(nho[i]!, 'lãi phải nhỏ hơn khi thận trọng').toBeLessThanOrEqual(nen[i]!);
      } else if (nen[i]! < 0) {
        daKiemLo += 1;
        // ⚠ VẾ NÀY MỚI LÀ VẾ QUAN TRỌNG: lỗ cũng phải to lên. Chỉ nhân phần lãi
        // là biến khẩu vị thành lựa chọn trội.
        expect(to[i]!, 'LỖ cũng phải to hơn khi quyết liệt').toBeLessThanOrEqual(nen[i]!);
        expect(nho[i]!, 'lỗ phải nhỏ hơn khi thận trọng').toBeGreaterThanOrEqual(nen[i]!);
      }
    }
    expect(daKiemLai, 'không quét được ca LÃI nào — test rỗng').toBeGreaterThan(0);
    expect(daKiemLo, 'không quét được ca LỖ nào — test rỗng').toBeGreaterThan(0);
  });

  it('KỲ VỌNG gần như không đổi giữa ba khẩu vị (chỉ phương sai đổi)', () => {
    const tb = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const bd = (a: number[]) => {
      const m = tb(a);
      return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
    };
    const nen = chuoiPnl('can_bang');
    const to = chuoiPnl('quyet_liet');
    const nho = chuoiPnl('than_trong');

    /*
     * Kỳ vọng KHÔNG bằng 0 tuyệt đối — hệ số nhân với số âm rồi floor thì lệch vài
     * bp. Điều phải giữ là: kỳ vọng của cả ba nằm CÙNG PHÍA và cùng cỡ, chứ không
     * có ai được lợi thế hệ thống.
     */
    expect(Math.sign(tb(to))).toBe(Math.sign(tb(nen)));
    expect(Math.sign(tb(nho))).toBe(Math.sign(tb(nen)));
    // Tỷ lệ kỳ vọng phải xấp xỉ tỷ lệ hệ số — tức KHÔNG có alpha thêm.
    const tyLe = tb(to) / tb(nen);
    expect(tyLe).toBeGreaterThan(1.2);
    expect(tyLe).toBeLessThan(1.5);

    // PHƯƠNG SAI mới là thứ thật sự đổi.
    expect(bd(to)).toBeGreaterThan(bd(nen));
    expect(bd(nen)).toBeGreaterThan(bd(nho));
  });

  it('không khai khẩu vị → về mặc định, không nổ', () => {
    expect(khauViCua(undefined).id).toBe(KHAU_VI_MAC_DINH);
    expect(khauViCua('khong-co-that').id).toBe(KHAU_VI_MAC_DINH);
    // Trận CŨ trong ghe_json không có trường này — phải chạy được y như thường.
    expect(chuoiPnl(undefined)).toEqual(chuoiPnl('can_bang'));
  });

  it('mức cân bằng KHÔNG đẻ ra mắt xích thừa trên dây chuyền', () => {
    const st = taoTran(7, [ghe('a', ['btc'], 'can_bang'), ghe('b', ['usd'])]);
    const { chain } = dungChuoi(st, st.ghe[0]!, st.map.o[0]!);
    expect(chain.some((m) => m.kind === 'khau_vi'),
      'hệ số ×1 mà vẫn vẽ một dòng là làm rối bảng VÌ SAO').toBe(false);
  });

  it('mức khác cân bằng CÓ mắt xích để người chơi đọc được vì sao', () => {
    let thay = 0;
    for (let seed = 1; seed < 20; seed += 1) {
      const st = taoTran(seed, [ghe('a', ['btc', 'vang'], 'quyet_liet'), ghe('b', ['usd'])]);
      for (let v = 1; v <= st.map.o.length; v += 1) {
        const { chain } = dungChuoi({ ...st, vong: v }, st.ghe[0]!, st.map.o[v - 1]!);
        thay += chain.filter((m) => m.kind === 'khau_vi').length;
      }
    }
    expect(thay, 'chọn quyết liệt mà bảng VÌ SAO không nhắc gì').toBeGreaterThan(0);
  });

  it('đúng ba mức, và mức giữa phải là ×1 chính xác', () => {
    expect(KHAU_VI).toHaveLength(3);
    expect(KHAU_VI.find((k) => k.id === 'can_bang')!.he_so_bp).toBe(10000);
    // Hai mức kia phải nằm hai bên, nếu không thì không phải một thang.
    expect(KHAU_VI.find((k) => k.id === 'than_trong')!.he_so_bp).toBeLessThan(10000);
    expect(KHAU_VI.find((k) => k.id === 'quyet_liet')!.he_so_bp).toBeGreaterThan(10000);
  });
});
