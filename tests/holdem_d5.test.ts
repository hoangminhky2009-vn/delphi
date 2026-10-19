/**
 * D5 — HAI CƠ CHẾ KHẮC CHẾ, và luật "KHÔNG ĐƯỢC LÀ CODE CHẾT".
 *
 * Chỉ đạo founder 25/07: "không thể cân bằng tuyệt đối nên hãy nghĩ cách thêm bài
 * hay tính năng khắc chế". Hai thứ ra đời từ đó:
 *   · thẻ ĐI NGƯỢC — thưởng vị thế lệch đám, phạt vị thế theo đám;
 *   · RỦI RO ĐỐI TÁC — cả bàn cùng núp một thẻ phòng thủ thì phần che teo lại.
 *
 * ⚠ TEST QUAN TRỌNG NHẤT Ở ĐÂY LÀ "CƠ CHẾ CÓ CHẠY KHÔNG", không phải "chạy đúng
 * chưa". Đo được 26/07: bật và tắt `RUI_RO_DOI_TAC` cho ra kết quả Monte Carlo
 * GIỐNG NHAU TỪNG CHỮ SỐ ở 12.000 trận — vì ngưỡng 60% không bao giờ chạm ở bàn 5
 * ghế (chỉ 2/5 bot cùng cầm `chan_lo` = 40%). Một tham số không bao giờ kích hoạt
 * không phải "cân bằng lỏng", nó là CODE CHẾT ĐỘI LỐT THAM SỐ — và nó lặng lẽ làm
 * mọi kết luận gate về nó thành vô nghĩa.
 *
 * Cùng lớp lỗi đã mắc ở D2 (gate "cắt lỗ không thành meta" chạy trên đàn bot mà
 * chưa con nào hay bỏ) và suýt mắc lại ở D5 (thẻ Đi Ngược không archetype nào cầm).
 */
import { describe, expect, it } from 'vitest';
import { dungChuoi, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { BOT_CHOI_DUOC, BOT_V1_DONG_BANG } from '../server/holdem/bots.js';
import {
  CHIEN_THUAT, DI_NGUOC, RUI_RO_DOI_TAC, type ChienThuatId,
} from '../config/holdem.js';

const ghe = (id: string, ts: string[], ct: ChienThuatId[]): GheMoi =>
  ({ id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: ts, chien_thuat: ct } });

/** Quét nhiều seed/vòng, đếm mắt xích loại `kind` xuất hiện bao nhiêu lần. */
function demMatXich(dungBan: () => ReturnType<typeof taoTran>, kind: string): number {
  let n = 0;
  for (let seed = 1; seed < 40; seed += 1) {
    const st = { ...dungBan(), seed };
    for (let v = 1; v <= st.map.o.length; v += 1) {
      const o = st.map.o[v - 1]!;
      const { chain } = dungChuoi({ ...st, vong: v }, st.ghe[0]!, o);
      n += chain.filter((m) => m.kind === kind).length;
    }
  }
  return n;
}

describe('D5 — cơ chế phải THỰC SỰ chạy, không phải tham số nằm chơi', () => {
  it('RỦI RO ĐỐI TÁC có nổ khi đủ người cùng núp một thẻ', () => {
    // 3/5 ghế cùng cầm chan_lo = 60%, vượt mọi ngưỡng đang xét.
    const n = demMatXich(() => taoTran(1, [
      ghe('a', ['vang'], ['chan_lo']), ghe('b', ['usd'], ['chan_lo']),
      ghe('c', ['tpcp'], ['chan_lo']), ghe('d', ['btc'], []), ghe('e', ['cp_cn'], []),
    ]), 'doi_tac');
    expect(n, 'cơ chế không nổ lần nào — code chết đội lốt tham số').toBeGreaterThan(0);
  });

  it('KHÔNG nổ khi chỉ một mình cầm thẻ — một người không phải "cả làng"', () => {
    const n = demMatXich(() => taoTran(1, [
      ghe('a', ['vang'], ['chan_lo']), ghe('b', ['usd'], []),
      ghe('c', ['tpcp'], []), ghe('d', ['btc'], []), ghe('e', ['cp_cn'], []),
    ]), 'doi_tac');
    expect(n).toBe(0);
  });

  it('ngưỡng phải ĐẠT ĐƯỢC với đàn bot thật, không chỉ trên giấy', () => {
    /*
     * Ngưỡng 60% từng chết vì ở bàn 5 ghế chỉ 2/5 bot cùng cầm `chan_lo`. Test này
     * khoá chính điều kiện đó: ngưỡng phải nằm dưới mức mà đàn bot THẬT chạm tới.
     */
    const soBotThuPhongThu = BOT_CHOI_DUOC.filter((b) =>
      ['phong_thu', 'da_dang'].includes(b.id)).length;
    const tyLeDatDuoc = Math.floor((10000 * soBotThuPhongThu) / 5);
    expect(RUI_RO_DOI_TAC.NGUONG_BP,
      `đàn bot chỉ đạt tối đa ${tyLeDatDuoc}bp — ngưỡng cao hơn thế là không bao giờ nổ`)
      .toBeLessThanOrEqual(tyLeDatDuoc);
  });

  it('THẺ ĐI NGƯỢC có ít nhất MỘT archetype cầm — nếu không, gate đo số 0', () => {
    const coNguoiCam = BOT_CHOI_DUOC.some((b) => b.id === 'nguoc_dong');
    expect(coNguoiCam, 'thẻ khắc chế không ai cầm thì Monte Carlo đo một chiến lược '
      + 'không tồn tại — đúng lỗi đã mắc ở D2').toBe(true);
    expect(CHIEN_THUAT.some((c) => c.id === 'di_nguoc')).toBe(true);
  });

  it('ĐI NGƯỢC thưởng khi lệch đám, phạt khi theo đám', () => {
    // Ghế 'a' ôm mã KHÔNG ai khác ôm → phải được thưởng.
    const lech = demMatXich(() => taoTran(1, [
      ghe('a', ['tpcp'], ['di_nguoc']), ghe('b', ['btc'], []),
      ghe('c', ['btc'], []), ghe('d', ['btc'], []), ghe('e', ['btc'], []),
    ]), 'di_nguoc');
    expect(lech, 'ôm mã hiếm mà thẻ không nói gì').toBeGreaterThan(0);
  });

  it('ĐI NGƯỢC có TRẦN hai chiều — không cộng dồn thành thẻ mạnh nhất bàn', () => {
    expect(DI_NGUOC.TRAN_BP).toBeGreaterThan(0);
    // Ôm 4 mã hiếm: nếu không trần thì 4 × THUONG_BP.
    expect(DI_NGUOC.TRAN_BP).toBeLessThan(4 * DI_NGUOC.THUONG_BP);
  });
});

describe('D5 — thêm bot KHÔNG được viết lại lịch sử trận cũ', () => {
  it('đàn bản 1 ĐÓNG BĂNG vẫn đủ 6 và đúng thứ tự', () => {
    /*
     * `botCuaGhe` suy danh tính trận CŨ bằng `(seed + i) % độ_dài`. Đổi mảng này là
     * viết lại đối thủ của mọi trận đã lưu chưa có `bot_id` — im lặng, không lỗi.
     * Nó không phải cấu hình cân bằng, nó là DẤU VẾT LỊCH SỬ.
     */
    expect(BOT_V1_DONG_BANG).toEqual([
      'tat_tay', 'phong_thu', 'da_dang', 'duoi_da', 'bat_day', 'khac_che',
    ]);
  });

  it('mọi id trong đàn bản 1 vẫn còn tồn tại trong đàn đang sống', () => {
    for (const id of BOT_V1_DONG_BANG) {
      expect(BOT_CHOI_DUOC.some((b) => b.id === id),
        `bot "${id}" bị xoá — trận cũ dựng lại sẽ nổ`).toBe(true);
    }
  });
});
