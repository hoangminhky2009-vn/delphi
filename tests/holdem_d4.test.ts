/**
 * D4 — PHẢN THÂN: thị trường phản ứng lại chính hành vi của lobby.
 *
 * Cụm này là cụm RỦI RO CÂN BẰNG CAO NHẤT của cả D-series, và nó sửa thứ duy nhất
 * trong engine từng được coi là bất biến: nội dung ô thị trường. Nên test ở đây
 * canh BẤT BIẾN trước, hiệu ứng sau.
 *
 * BỐN BẤT BIẾN, mất một cái là hỏng một thứ khác hẳn nhau:
 *   1. GIỮ LOẠI Ô — sự kiện↔sự kiện, giai đoạn↔giai đoạn. Mất cái này là mọi con
 *      số đã công bố (tổng vòng, còn mấy ô, mấy giai đoạn/sự kiện) thành lời khai
 *      sai, và `daKetThuc` + quota cắt lỗ đọc `map.o.length` sẽ lệch.
 *   2. TẤT ĐỊNH — cùng (seed, log) ra cùng map. Mất cái này là replay vô nghĩa,
 *      mà toàn bộ kiến trúc trận dựa trên replay (không lưu state).
 *   3. KHÔNG THAY Ô ĐANG BỊ TELEGRAPH — ô giai đoạn ngay sau sự kiện THẬT đã được
 *      hứa "nghiêng về X" và API đã gửi lời hứa đó ra. Thay nó là bẻ lời mình vừa nói.
 *   4. CỬA TẮT PHẢI THẬT — `PHAN_THAN.BAT=0` thì không một ô nào bị thay. Không có
 *      cửa này thì không cô lập được cơ chế để đo, và mọi kết luận gate là đoán
 *      (bài học D1: ba lần đoán theo tên bot là ba lần đo sai biến).
 */
import { describe, expect, it } from 'vitest';
import {
  apPhanThan, demTheoMa, giaiQuyetVong, huongDonCuaLobby, taoTran,
  type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { PHAN_THAN, tyLeBp } from '../config/holdem.js';

function ghe(id: string, taiSan: string[] = []): GheMoi {
  return { id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: taiSan, chien_thuat: [] } };
}
const THEO = () => ({ loai: 'theo' as const });

/** Bàn n ghế, MỌI ghế nắm cùng `ma` — đám đông tối đa. */
function banDon(seed: number, n: number, ma: string): TrangThaiTran {
  const st = taoTran(seed, Array.from({ length: n }, (_, i) => ghe(`g${i}`, [ma])));
  // Giả lập "đã nắm từ vòng trước" để đủ điều kiện 2 vòng liên tiếp.
  return { ...st, dong_truoc: demTheoMa(st.ghe) };
}

describe('demTheoMa — đếm người nắm, không đếm lá', () => {
  it('stack nhiều bản sao cùng mã vẫn chỉ là MỘT người nắm', () => {
    const st = taoTran(5, [ghe('a', ['btc', 'btc', 'btc']), ghe('b', ['btc'])]);
    expect(demTheoMa(st.ghe).btc).toBe(2);
  });

  it('người đã CHÁY không còn là áp lực dòng tiền nào', () => {
    let st = taoTran(5, [ghe('a', ['btc']), ghe('b', ['btc'])]);
    st = { ...st, ghe: st.ghe.map((g) => (g.id === 'b' ? { ...g, da_chay: true } : g)) };
    expect(demTheoMa(st.ghe).btc).toBe(1);
  });
});

describe('huongDonCuaLobby — điều kiện 2 vòng LIÊN TIẾP', () => {
  it('vòng đầu (chưa có dong_truoc) → KHÔNG kích hoạt', () => {
    const st = taoTran(5, [ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['btc'])]);
    expect(st.dong_truoc).toBeUndefined();
    expect(huongDonCuaLobby(st), '"liên tiếp" cần có vòng trước để mà so').toBeNull();
  });

  it('cả bàn dồn risk-on hai vòng liền → "don"', () => {
    expect(huongDonCuaLobby(banDon(7, 5, 'btc'))).toBe('don');
  });

  it('cả bàn trốn phòng thủ hai vòng liền → "tron"', () => {
    expect(huongDonCuaLobby(banDon(7, 5, 'vang'))).toBe('tron');
  });

  it('dồn vòng NÀY nhưng vòng trước thì không → KHÔNG kích hoạt', () => {
    const st = banDon(7, 5, 'btc');
    // Vòng trước chỉ 1 người nắm → chưa "liên tiếp".
    expect(huongDonCuaLobby({ ...st, dong_truoc: { btc: 1 } })).toBeNull();
  });

  it('DƯỚI ngưỡng thì không kích hoạt, và ngưỡng đo bằng TỶ LỆ lobby', () => {
    // 2/5 = 40% < 60%.
    const st = taoTran(7, [
      ghe('a', ['btc']), ghe('b', ['btc']), ghe('c', ['vn30']),
      ghe('d', ['tpcp']), ghe('e', ['tpcp'])]);
    expect(huongDonCuaLobby({ ...st, dong_truoc: demTheoMa(st.ghe) })).toBeNull();
    expect(tyLeBp(2, 5)).toBeLessThan(PHAN_THAN.NGUONG_LOBBY_BP);
  });

  it('CÙNG TỶ LỆ thì cùng phán quyết ở bàn 4 và bàn 8 (nối tiếp D3)', () => {
    expect(huongDonCuaLobby(banDon(11, 4, 'btc'))).toBe('don');
    expect(huongDonCuaLobby(banDon(11, 8, 'btc'))).toBe('don');
  });
});

describe('apPhanThan — BẤT BIẾN 1: giữ LOẠI ô và SỐ LƯỢNG ô', () => {
  it('số ô KHÔNG đổi (tổng vòng, quota cắt lỗ, daKetThuc đều đọc length)', () => {
    const st = banDon(13, 5, 'btc');
    for (let v = 2; v <= st.map.o.length; v += 1) {
      expect(apPhanThan(st, v).map.o).toHaveLength(st.map.o.length);
    }
  });

  it('LOẠI của TỪNG ô không đổi (bộ bài còn lại vẫn nói thật)', () => {
    const st = banDon(13, 5, 'btc');
    const loaiGoc = st.map.o.map((o) => o.kind);
    for (let v = 2; v <= st.map.o.length; v += 1) {
      expect(apPhanThan(st, v).map.o.map((o) => o.kind)).toEqual(loaiGoc);
    }
  });

  it('CHỈ ô của vòng được chỉ định bị đụng, các ô khác nguyên vẹn', () => {
    const st = banDon(17, 5, 'btc');
    const v = 4;
    const sau = apPhanThan(st, v);
    for (let i = 0; i < st.map.o.length; i += 1) {
      if (i === v - 1) continue;
      expect(sau.map.o[i], `ô ${i} không được đụng`).toEqual(st.map.o[i]);
    }
  });

  it('sự kiện bị thay thì bao_truoc ĐI THEO sự kiện mới', () => {
    // Quét nhiều seed để chắc có ít nhất một lần thay ô sự kiện.
    let thayIt = 0;
    for (let seed = 1; seed < 60; seed += 1) {
      const st = banDon(seed, 5, 'btc');
      for (let v = 2; v <= st.map.o.length; v += 1) {
        const sau = apPhanThan(st, v);
        const a = st.map.o[v - 1]!; const b = sau.map.o[v - 1]!;
        if (a === b || a.kind !== 'su_kien' || b.kind !== 'su_kien') continue;
        thayIt += 1;
        // Telegraph phải nói về TIN MỚI, không phải tin đã không còn tồn tại.
        expect(b.bao_truoc).not.toBeUndefined();
        expect(b.la_tin_gia, 'phản thân đổi TIN GÌ, không đổi thật/bịa')
          .toBe(a.la_tin_gia);
      }
    }
    expect(thayIt, 'không quét được lần thay ô sự kiện nào — test này rỗng')
      .toBeGreaterThan(0);
  });
});

describe('apPhanThan — BẤT BIẾN 2: tất định', () => {
  it('gọi hai lần cùng đầu vào → map giống nhau tới từng ô', () => {
    const st = banDon(23, 5, 'btc');
    for (let v = 2; v <= st.map.o.length; v += 1) {
      expect(JSON.stringify(apPhanThan(st, v).map.o))
        .toBe(JSON.stringify(apPhanThan(st, v).map.o));
    }
  });

  it('hàm THUẦN — không sửa state cũ', () => {
    const st = banDon(23, 5, 'btc');
    const truoc = JSON.stringify(st.map.o);
    apPhanThan(st, 3);
    expect(JSON.stringify(st.map.o)).toBe(truoc);
  });

  it('chạy trọn trận hai lần cùng seed → cùng nhật ký phản thân', () => {
    const chay = () => {
      let st: TrangThaiTran = taoTran(31, ['a', 'b', 'c', 'd', 'e'].map((x) => ghe(x, ['btc'])));
      for (let i = 0; i < 6; i += 1) st = giaiQuyetVong(st, THEO).trangThai;
      return JSON.stringify(st.phan_than ?? []);
    };
    expect(chay()).toBe(chay());
  });
});

describe('apPhanThan — BẤT BIẾN 3: không thay ô đang bị telegraph', () => {
  it('ô giai đoạn ngay sau sự kiện THẬT thì KHÔNG bị thay', () => {
    let daKiem = 0;
    for (let seed = 1; seed < 120; seed += 1) {
      const st = banDon(seed, 5, 'btc');
      for (let v = 2; v <= st.map.o.length; v += 1) {
        const o = st.map.o[v - 1]!; const truoc = st.map.o[v - 2];
        if (o.kind !== 'giai_doan') continue;
        if (truoc?.kind !== 'su_kien' || truoc.la_tin_gia) continue;
        daKiem += 1;
        expect(apPhanThan(st, v).map.o[v - 1], 'đã hứa nghiêng về X rồi thì phải giữ lời')
          .toEqual(o);
      }
    }
    expect(daKiem, 'không quét được ca telegraph nào — test này rỗng').toBeGreaterThan(0);
  });
});

describe('apPhanThan — BẤT BIẾN 4: cửa tắt phải thật', () => {
  it('không kích hoạt khi lobby chưa dồn → map y nguyên', () => {
    const st = taoTran(41, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['tpcp']),
      ghe('d', ['usd']), ghe('e', ['cp_cn'])]);
    const co = { ...st, dong_truoc: demTheoMa(st.ghe) };
    for (let v = 2; v <= st.map.o.length; v += 1) {
      expect(apPhanThan(co, v).map.o).toEqual(st.map.o);
    }
  });

  it('bàn còn ≤1 ghế sống → không kích hoạt (không chia cho 0)', () => {
    let st = banDon(43, 5, 'btc');
    st = { ...st, ghe: st.ghe.map((g, i) => (i === 0 ? g : { ...g, da_chay: true })) };
    expect(huongDonCuaLobby(st)).toBeNull();
  });

  it('vòng ngoài dải map → trả nguyên state, không nổ', () => {
    const st = banDon(43, 5, 'btc');
    expect(apPhanThan(st, 999)).toBe(st);
    expect(apPhanThan(st, 0)).toBe(st);
  });
});

describe('giaiQuyetVong — nối vào chốt phiên', () => {
  it('chốt phiên ghi dong_truoc cho vòng sau', () => {
    const st = taoTran(53, ['a', 'b', 'c'].map((x) => ghe(x, ['btc'])));
    const sau = giaiQuyetVong(st, THEO).trangThai;
    expect(sau.dong_truoc, 'thiếu dong_truoc thì "2 vòng liên tiếp" không đo được')
      .toBeTruthy();
  });

  it('cả bàn dồn btc nhiều vòng → CÓ ô bị thay, và nhật ký kể lại được', () => {
    let st: TrangThaiTran = taoTran(59, ['a', 'b', 'c', 'd', 'e'].map((x) => ghe(x, ['btc'])));
    for (let i = 0; i < 6; i += 1) st = giaiQuyetVong(st, THEO).trangThai;
    const nk = st.phan_than ?? [];
    expect(nk.length, 'dồn cả bàn suốt 6 vòng mà không lần nào phản thân nổ').toBeGreaterThan(0);
    for (const x of nk) {
      expect(x.vi).toBe('don');
      expect(x.tu).not.toBe(x.den);
    }
  });
});
