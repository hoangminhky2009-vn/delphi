/**
 * PFM — CHÂN DUNG HÀNH TINH (`chan_dung_hanh.ts`, 21/09). Ba câu ĐO của phỏng vấn ⇒ một
 * toạ độ ⇒ một trong 27 chân dung (9 ô của lưới 3×3, nhân 3 vành đai). Theo demo đã chốt
 * `docs/ui-ux/demo/pfm-chan-dung.html` (A11.25 — demo đứng trên mọi văn bản kế hoạch).
 *
 * ⚠⚠ Bài đắt nhất là §I: `DIEM_B`/`DIEM_DAU`/`DIEM_KE_HOACH` CHÉP NHÃN từ `phong_van.ts`
 * bằng tay — không import chung một hằng nào. Lệch một chữ (kể cả một dấu cách) thì
 * `diem()` tra ra `undefined` ⇒ trục câm lặng thành "chưa đo", KHÔNG throw, KHÔNG log,
 * và chân dung vẫn vẽ được — chỉ là vẽ sai.
 * ⚠ Bài §II quét CẠN mọi tổ hợp đáp án để bắt Ô CHẾT — loại lỗi chỉ lộ ra khi nhìn 16 tổ
 * hợp CÙNG LÚC (`config/pfm.ts` kể lại ca thật: bảng điểm đầu 10·25·78·95 chỉ phủ 6/9),
 * không lộ ra khi đọc từng con số riêng lẻ.
 * ⚠ Bài §III khoá phép LẬT HÀNG (`2 - hb`) — bỏ phép lật này vẫn biên dịch, vẫn chạy, vẫn
 * ra một ô hợp lệ, và không bài nào khác (kể cả §II) bắt được vì §II chỉ đếm SỐ Ô phủ
 * được chứ không quan tâm ô nào khớp hàng nào.
 */
import { describe, expect, it } from 'vitest';
import { PFM } from '@config/pfm';
import { CAU_PV } from '../src/pfm/phong_van.js';
import {
  DIEM_B, DIEM_DAU, DIEM_KE_HOACH, oHanhTinh, toaDoTuNhan, trucSatRia, vanhDai,
  type ToaDoChanDung,
} from '../src/pfm/chan_dung_hanh.js';

/** Nhãn đáp án (nguyên văn) của một câu trong `CAU_PV` — dùng để so khoá với các bảng điểm. */
function dapCuaCau(id: string): readonly string[] {
  const c = CAU_PV.find((x) => x.id === id);
  if (!c) throw new Error(`⚠ không tìm thấy câu "${id}" trong CAU_PV — phong_van.ts đã đổi id?`);
  return c.dap;
}

describe('§I — ⭐⭐⭐ KHOÁ HAI BẢNG VỚI CÂU HỎI (bài quan trọng nhất tệp này)', () => {
  /*
   * ⚠⚠ So CẢ HAI CHIỀU bằng cách so hai mảng khoá ĐÃ SẮP: thừa một khoá ở `DIEM_*` (nhãn ma,
   * không câu nào hỏi) hay thiếu một khoá (câu hỏi có nhãn mà bảng điểm không biết) đều phải
   * đỏ như nhau — lệch một ký tự ở MỘT bên thôi cũng đủ làm mảng sort lệch nhau.
   */
  it('DIEM_B khớp CHÍNH XÁC tập dap của câu luc_tien_ve — không thừa không thiếu', () => {
    expect(Object.keys(DIEM_B).sort()).toEqual([...dapCuaCau('luc_tien_ve')].sort());
  });

  it('DIEM_DAU khớp CHÍNH XÁC tập dap của câu sau_khi_tieu — không thừa không thiếu', () => {
    expect(Object.keys(DIEM_DAU).sort()).toEqual([...dapCuaCau('sau_khi_tieu')].sort());
  });

  it('DIEM_KE_HOACH khớp CHÍNH XÁC tập dap của câu dau_thang — không thừa không thiếu', () => {
    expect(Object.keys(DIEM_KE_HOACH).sort()).toEqual([...dapCuaCau('dau_thang')].sort());
  });
});

describe('§II — ⭐⭐⭐ QUÉT CẠN PHỦ Ô: mọi tổ hợp (b × đau) phải chạm đủ 9 ô của lưới 3×3', () => {
  /*
   * ⚠⚠ CA THẬT (xem `config/pfm.ts` §CHÂN DUNG HÀNH TINH): bảng điểm ĐẦU TIÊN của trục đau
   * là 10·25·78·95 — cả bốn rơi vào hai vùng NGOÀI (thấp/cao), cột GIỮA không đáp án nào
   * với tới ⇒ 3/9 hành tinh thành Ô CHẾT, không nhìn con số riêng lẻ nào thấy được. Bài
   * này quét trên bảng điểm ĐANG CHẠY (không chép số cũ vào đây) nên số đổi thì tự chạy lại.
   */
  it('mọi tổ hợp nhãn b × nhãn đau phủ đủ 9 ô — không ô nào chết', () => {
    const oDaCham = new Set<string>();
    for (const nhanB of Object.keys(DIEM_B)) {
      for (const nhanDau of Object.keys(DIEM_DAU)) {
        // Vành đai (trục thứ ba) không ảnh hưởng tới ô — cố định một nhãn hợp lệ bất kỳ.
        const toa = toaDoTuNhan(nhanB, nhanDau, 'đại khái');
        const o = oHanhTinh(toa);
        expect(o, `(${nhanB} × ${nhanDau}) lẽ ra phải ra một ô — cả hai trục đều có nhãn hợp lệ`)
          .not.toBeNull();
        oDaCham.add(`${o!.hang}-${o!.cot}`);
      }
    }
    for (let hang = 0; hang < 3; hang++) {
      for (let cot = 0; cot < 3; cot++) {
        expect(
          oDaCham.has(`${hang}-${cot}`),
          `ô (hàng ${hang}, cột ${cot}) là Ô CHẾT — không tổ hợp đáp án nào của bảng điểm hiện tại rơi vào đây`,
        ).toBe(true);
      }
    }
  });
});

describe('§III — ⭐⭐ PHÉP LẬT HÀNG: b CAO (muốn ngay) phải nằm hàng TRÊN (gần mặt trời)', () => {
  /*
   * ⚠⚠ `oHanhTinh` tính `hang = 2 - vung(b)`, KHÔNG PHẢI `vung(b)` thẳng — trực giác lập
   * trình tự nhiên ("vùng nào thì hàng đó") là chính cái lỗi copy-paste dễ xảy ra nhất ở
   * đây. Bỏ phép lật `2 - hb` thì code vẫn biên dịch, vẫn chạy, vẫn trả về một ô HỢP LỆ
   * trong lưới 3×3 — §II vẫn xanh (nó chỉ đếm SỐ Ô phủ được, không quan tâm ô nào khớp
   * hàng nào) — nên phải có bài riêng khoá đúng CHIỀU của phép lật.
   */
  it('⭐ b CAO nhất ("chưa nghĩ đã vơi") ⇒ hàng 0; b THẤP nhất ("cất một phần đi") ⇒ hàng 2', () => {
    const caoNhat = oHanhTinh(toaDoTuNhan('chưa nghĩ đã vơi', 'thấy đáng', 'đại khái'));
    const thapNhat = oHanhTinh(toaDoTuNhan('cất một phần đi', 'thấy đáng', 'đại khái'));
    expect(caoNhat?.hang, 'b cao (muốn ngay) phải ở hàng 0 (gần mặt trời), KHÔNG phải hàng 2')
      .toBe(0);
    expect(thapNhat?.hang, 'b thấp (không vội) phải ở hàng 2, KHÔNG phải hàng 0').toBe(2);
  });
});

describe('§IV — ⭐⭐ P7: THIẾU MẪU LÀ null, KHÔNG PHẢI 0 hay vùng giữa bịa ra', () => {
  it('thiếu MỘT trong hai trục (b hoặc đau) ⇒ oHanhTinh trả null, KHÔNG lấp bằng vùng giữa', () => {
    const thieuB: ToaDoChanDung = { b: null, dau: 50, kh: 1 };
    const thieuDau: ToaDoChanDung = { b: 50, dau: null, kh: 1 };
    expect(oHanhTinh(thieuB), 'thiếu b ⇒ null, không phải {hang:1,...} lấp giữa').toBeNull();
    expect(oHanhTinh(thieuDau), 'thiếu dau ⇒ null, không phải {...,cot:1} lấp giữa').toBeNull();
  });

  it('nhãn lạ (không có trong bảng điểm) ⇒ null, KHÔNG PHẢI 0', () => {
    const toa = toaDoTuNhan('nhãn không tồn tại trong danh sách', 'thấy đáng', 'đại khái');
    expect(toa.b, 'nhãn lạ tra bảng ra undefined — phải đúc thành null, không rơi về 0').toBeNull();
  });

  it('vanhDai thiếu kh (null) ⇒ 1 — vành MẢNH (giữa), không phải "tuỳ hứng" (0)', () => {
    expect(vanhDai({ b: 50, dau: 50, kh: null })).toBe(1);
    // ⚠ kh=0 là một giá trị THẬT ("tuỳ hứng") — `?? 1` không được đè lên số 0 hợp lệ
    // (bẫy kinh điển: `||` thay vì `??` sẽ biến 0 thành 1, khác hẳn "thiếu mẫu" của null).
    expect(vanhDai({ b: 50, dau: 50, kh: 0 }), 'kh=0 THẬT phải giữ nguyên 0').toBe(0);
  });
});

describe('§V — ⭐⭐ trucSatRia: đọc NGƯỠNG từ config, không chép số', () => {
  const [THAP, CAO] = PFM.CHAN_DUNG_MOC_VUNG;
  const RIA = PFM.CHAN_DUNG_SAT_RIA;

  it('⭐ điểm cách một mốc đúng RIA (biên) ⇒ trục đó CÓ trong kết quả', () => {
    expect(trucSatRia({ b: THAP! + RIA, dau: 50, kh: 1 })).toEqual(['b']);
    expect(trucSatRia({ b: 50, dau: CAO! - RIA, kh: 1 })).toEqual(['dau']);
  });

  it('điểm GIỮA vùng (xa cả hai mốc hơn RIA) ⇒ trục đó KHÔNG trong kết quả', () => {
    const giua = (THAP! + CAO!) / 2; // cách đều hai mốc — đủ xa cả hai đầu với RIA hiện tại
    expect(trucSatRia({ b: giua, dau: giua, kh: 1 })).toEqual([]);
  });

  it('cả hai trục cùng sát rìa (mỗi trục một mốc khác nhau) ⇒ cả hai có mặt, đúng thứ tự b rồi dau', () => {
    expect(trucSatRia({ b: THAP!, dau: CAO!, kh: 1 })).toEqual(['b', 'dau']);
  });

  it('trục null (chưa đo) ⇒ không được tính là sát rìa dù trục kia sát thật', () => {
    expect(trucSatRia({ b: null, dau: THAP!, kh: 1 })).toEqual(['dau']);
    expect(trucSatRia({ b: THAP!, dau: null, kh: 1 })).toEqual(['b']);
  });
});
