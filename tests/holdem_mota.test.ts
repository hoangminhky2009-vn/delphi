/**
 * CHÚ THÍCH THẺ = ĐẶC ĐIỂM NGOÀI ĐỜI, không phải tác dụng trong game.
 *
 * Chỉ đạo founder 26/07. Hai lý do (xem docstring `CHIEN_THUAT`): tờ (!) đã kể tác
 * dụng game bằng mức định tính rồi nên chú thích lặp lại là chiếm chỗ; và thứ người
 * chơi mang ra khỏi trận phải là kiến thức thật, vì đó mới là sản phẩm (A1).
 *
 * Test này canh chú thích không TRÔI NGƯỢC về mô tả cơ chế — chuyện rất dễ xảy ra
 * khi thêm thẻ mới, vì lúc cân bằng thì cơ chế là thứ trong đầu mình.
 */
import { describe, expect, it } from 'vitest';
import { CHIEN_THUAT, DAC_QUYEN, SU_KIEN, TAI_SAN } from '../config/holdem.js';
import { dungTuDien } from '../server/holdem/tu_dien.js';

/** Từ vựng CHỈ tồn tại trong trò chơi — xuất hiện là chú thích đã nói về game. */
const TU_GAME = [
  'vòng', 'bàn ', 'cháy tài khoản', 'bp', 'quỹ vòng', 'chốt phiên',
  'mắt xích', 'dây chuyền', 'ô thị trường',
];

describe('Chú thích thẻ nói chuyện NGOÀI ĐỜI', () => {
  const tatCa = [
    ...TAI_SAN.map((t) => ({ id: t.id, mo_ta: t.mo_ta })),
    ...CHIEN_THUAT.map((c) => ({ id: c.id, mo_ta: c.mo_ta })),
  ];

  it('không thẻ nào để trống chú thích', () => {
    for (const t of tatCa) {
      expect(t.mo_ta.trim().length, `thẻ "${t.id}" trống chú thích`).toBeGreaterThan(30);
    }
  });

  it('không chú thích nào dùng từ vựng CỦA TRÒ CHƠI', () => {
    for (const t of tatCa) {
      const thap = t.mo_ta.toLowerCase();
      for (const tu of TU_GAME) {
        expect(thap.includes(tu),
          `thẻ "${t.id}" nhắc "${tu.trim()}" — đó là từ của game, không phải đặc điểm `
          + 'ngoài đời. Tác dụng trong game đã có tờ (!) lo.').toBe(false);
      }
    }
  });

  it('đủ dài để dạy được một điều, không phải một dòng nhãn', () => {
    // Một câu 30 ký tự thì chỉ đủ gọi tên, không đủ nói nó LÀ GÌ ngoài đời.
    for (const t of tatCa) {
      expect(t.mo_ta.length, `thẻ "${t.id}" quá ngắn để dạy được gì`)
        .toBeGreaterThan(70);
    }
  });
});

/*
 * ĐẶC QUYỀN TRÊN TỜ (!) — founder 27/07: *"chiến thuật cũng phải có dấu ! ở góc
 * như tài sản để mô tả rõ thứ người chơi sẽ nhận được khi chọn chiến thuật này"*.
 *
 * ⚠ Nhóm test này canh CHIỀU NGƯỢC với phần trên của file. Phần trên cấm chú
 * thích MẶT THẺ nhắc cơ chế (D28 — mặt thẻ tả đặc điểm ngoài đời). Ở đây thì
 * BẮT BUỘC tờ (!) phải nói cơ chế. Hai lớp khác nhau, và nhầm lẫn hai lớp đó
 * chính là lý do tờ (!) của chiến thuật trước bản này thiếu đúng phần chính.
 */
describe('Tờ (!) chiến thuật — ĐẶC QUYỀN', () => {
  const td = dungTuDien(TAI_SAN, CHIEN_THUAT.map((c) => c.id));

  it('đúng 8 lá đã xây đặc quyền có mô tả — khớp DAC_QUYEN_THEO_THE', () => {
    /*
     * ⚠ 24/08 — `don_bay` VÀO DANH SÁCH. Điều kiện mà chú thích đầu
     * `dacQuyenMoTa()` đặt ra ("thêm dòng khi engine đổi thật") đã tới: D109 cho
     * CẤP 2 nhắm mã thứ hai (`engine.ts` đọc `danh_muc.gan_phu.don_bay`). Trước
     * đó tờ (!) của Đòn Bẩy chỉ có một câu tĩnh về nhân đôi — người chơi lên cấp
     * mà không đọc được ở đâu rằng mình vừa mua cái gì.
     * Ba lá còn trống ở bài dưới vẫn phải trống: viết mô tả cho một đặc quyền
     * chưa tồn tại là nói dối ngay trên tờ.
     */
    const co = Object.entries(td.chien_thuat)
      .filter(([, v]) => (v.dac_quyen ?? []).length > 0).map(([k]) => k).sort();
    expect(co).toEqual([
      'chan_lo', 'chia_lenh', 'da_dang_hoa', 'di_nguoc',
      'don_bay', 'khop_nhanh', 'luot_song', 'phong_ho']);
  });

  it('⭐ hai đặc quyền CẤP 2 đang chạy trong engine đều có một dòng trên tờ', () => {
    /*
     * Bịt đúng lỗ vừa tìm ra: cơ chế cấp 2 CHẠY THẬT mà tờ (!) im.
     * · Lướt Sóng cấp 2 = XÁC THỰC TIN (D107) — `bang_dien_tu.ts` đặt cờ `cap2`.
     * · Đòn Bẩy cấp 2 = đích PHỤ hai mã (D109) — `engine.ts` đọc `gan_phu`.
     * Một đặc quyền chỉ mở ra khi lên cấp mà tờ không nhắc thì người chơi không
     * có cách nào biết mình vừa đổi được gì bằng lá thứ hai.
     */
    expect(td.chien_thuat.luot_song?.dac_quyen?.join(' ') ?? '')
      .toMatch(/CẤP 2/);
    expect(td.chien_thuat.don_bay?.dac_quyen?.join(' ') ?? '')
      .toMatch(/CẤP 2/);
  });

  it('Chia Lệnh nói đúng đặc quyền mốc: mịn 5, thô 25 — số suy từ config', () => {
    const dong = td.chien_thuat.chia_lenh?.dac_quyen?.join(' ') ?? '';
    expect(dong).toContain('5%');
    expect(dong).toContain('25%');
  });

  it('Đi Ngược nói đúng bản chất: thấy CẦM GÌ, cân theo cỡ bàn', () => {
    const dong = td.chien_thuat.di_nguoc?.dac_quyen?.join(' ') ?? '';
    expect(dong).toMatch(/CẦM MÃ GÌ/);
    expect(dong).toMatch(/cỡ bàn/);
  });

  it('lá CHƯA xây đặc quyền thì KHÔNG có mô tả (không nói dối người chơi)', () => {
    for (const id of ['ban_khong', 'bat_day', 'mua_duoi']) {
      expect(td.chien_thuat[id]?.dac_quyen, `${id} có mô tả cho đặc quyền chưa tồn tại`)
        .toBeUndefined();
    }
  });

  /*
   * Số trong mô tả phải SUY TỪ CONFIG. Nếu ai chép tay thì đổi config xong tờ
   * (!) nói sai — và người chơi tin vào một con số không còn đúng.
   */
  it('số suy từ config, không chép tay', () => {
    expect(td.chien_thuat.luot_song?.dac_quyen?.join(' '))
      .toContain(String(DAC_QUYEN.LUOT_SONG.SO_TEN));
    expect(td.chien_thuat.da_dang_hoa?.dac_quyen?.join(' '))
      .toContain(String(DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG));
    // 2500 bp phải in ra "25", không phải "2500" — người chơi đọc %, không đọc bp.
    expect(td.chien_thuat.chan_lo?.dac_quyen?.join(' ')).toContain('25%');
    // 120 bp lẻ → "1,2%" kiểu Việt, không phải "1.2%".
    expect(td.chien_thuat.chan_lo?.dac_quyen?.join(' ')).toContain('1,2%');
  });

  it('Lướt Sóng phải nói rõ có 1 tên SAI — đặc quyền là BIẾT HẸP HƠN, không phải BIẾT TRƯỚC (D33)', () => {
    expect(td.chien_thuat.luot_song?.dac_quyen?.join(' ')).toMatch(/sai/i);
  });
});

/*
 * DÒNG CẢNH BÁO ĐUÔI (founder chốt phương án A, 28/07 — 00b §6.3): giữ SỐ,
 * thêm CHỮ. Mã "tốt trên giấy" trong khủng hoảng thanh khoản nhưng β D39 kéo
 * sập cùng đám đông ⇒ tờ (!) phải nói thẳng "tốt" là trung bình, không phải
 * lời hứa trong hoảng loạn.
 */
describe('Tờ (!) tài sản — cảnh báo đuôi khủng hoảng thanh khoản', () => {
  const td = dungTuDien(TAI_SAN, CHIEN_THUAT.map((c) => c.id));

  it('vàng/usd/tpcp CÓ dòng cảnh báo — kỳ vọng dương mà β bị kéo mạnh', () => {
    for (const ma of ['vang', 'usd', 'tpcp']) {
      expect(td.tai_san[ma]?.luu_y, `${ma} thiếu cảnh báo đuôi`).toMatch(/thanh khoản/);
    }
  });

  it('mã rủi ro KHÔNG có — chúng đã "xấu" sẵn trên giấy, không có gì mâu thuẫn', () => {
    for (const ma of ['btc', 'cp_cn', 'vn30']) {
      expect(td.tai_san[ma]?.luu_y, `${ma} thừa cảnh báo`).toBeUndefined();
    }
  });

  it('dòng cảnh báo NÊU TÊN sự kiện thật, suy từ config chứ không chép tay', () => {
    expect(td.tai_san.vang?.luu_y).toContain(
      SU_KIEN.find((x) => x.id === 'hack_san')!.label);
  });
});
