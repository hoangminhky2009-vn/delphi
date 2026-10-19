/**
 * PFM — TỰ ĐIỂN CHỮ (`lib/pfm_chu.ts`, D26): mọi chuỗi tiếng Việt của PFM ở một chỗ.
 *
 * ⚠ Bài đắt nhất là §I: quét `TU_KE_DON` trên **TOÀN BỘ** tự điển, không trên từng bảng.
 * Quét từng bảng là quên một bảng — và một câu kê đơn lọt vào sẽ sống rất lâu, vì nó
 * trông giống hệt một câu bình thường với người đọc code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHU_CHUYEN_TIEP_HU, CHU_DIEU_KIEN, CHU_HAN, CHU_HANH_DONG_LUAT, CHU_KHUNG,
  CHU_LOAI_CHI, CHU_NGUON_THU, CHU_TRANG_THAI_HU, CHU_TRANG_THAI_NGAY, CHU_TU_LAP,
  CHU_CONSENT_KHOI, CHU_UU_TIEN, O_CHU_LOAI_CHI, O_CHU_TOI_DA, VAN_BAN_CONSENT, moiChuoiPfm,
} from '../src/lib/pfm_chu';
import {
  CUM_KHONG_MENH_LENH, HE_TU_PHAI, TU_KE_DON, tuKeDonTrong,
} from '../src/lib/khoanh_khac';
import { CHUYEN_TIEP_HU, HANH_DONG_LUAT, TRANG_THAI_NGAY } from '@config/pfm_events';
import { CONSENT_PHIEN_BAN, CUA_PFM, vanBanCua } from '@config/pfm_consent';
import { SO_DANG_KY } from '@config/pfm_dac_trung';
import { DIEU_KIEN } from '../src/pfm/luat.js';
import { MA_CUA_SERVER } from '../src/pfm/dac_trung.js';
import { HAN_HU, LOAI_HU, TRANG_THAI_HU, UU_TIEN_HU } from '../src/pfm/hu.js';
import { NHOM_HU } from '../src/pfm/nhom_hu.js';

describe('§I — ⭐⭐⭐ A10 🔒 quét TOÀN BỘ tự điển', () => {
  it('⭐⭐⭐ không chuỗi nào chứa từ kê đơn', () => {
    /*
     * ⚠⚠ `moiChuoiPfm()` gom PHẲNG mọi bảng — nên bài này quét cả những bảng thêm sau,
     * miễn là chúng được nối vào hàm ấy. Quét từng bảng bằng tay là chắc chắn quên một
     * cái vào một ngày nào đó, và cái quên ấy không có triệu chứng.
     * ⚠ Dùng lại `TU_KE_DON` DÙNG CHUNG qua `tuKeDonTrong` (D61 — MỘT danh sách từ). Bộ
     *   cố ý THÔ — nó đã bắt tôi một lần trong chính đợt này ("có gì đáng NHỚ trong số
     *   đó"), và sửa chữ thường rẻ hơn nới guard. **Ngoại lệ đã đo:** hệ từ phủ định
     *   "không phải" — xem `HE_TU_PHAI` và §I-bis.
     */
    for (const s of moiChuoiPfm()) {
      expect(tuKeDonTrong(s), `"${s}" chứa từ kê đơn`).toEqual([]);
    }
  });

  it('quét được một lượng chuỗi THẬT — hàm gom không rỗng lặng lẽ', () => {
    // Không có dòng này thì `moiChuoiPfm()` trả `[]` cũng làm bài trên xanh.
    expect(moiChuoiPfm().length).toBeGreaterThan(50);
  });
});

describe('§I-bis — ⭐⭐⭐ CHÍNH BỘ QUÉT: "phải" mệnh lệnh vs "phải" hệ từ', () => {
  /*
   * ⚠⚠ Bài này canh CÁI CHỐT, không canh tự điển. Một chốt A10 nới sai là thảm hoạ; nhưng
   * một chốt A10 **quá thô** cũng có giá, và giá ấy đã trả thật (06/09, màn HŨ): nó ép
   * người viết đổi *"không phải xếp hạng của app"* thành *"khác xếp hạng của app"* — tức
   * bộ canh A10 làm YẾU một câu A10. Nên hai vế dưới đây đi cùng nhau, không tách.
   */
  it('⭐⭐⭐ VẪN bắt mệnh lệnh thật — vá không được nới', () => {
    expect(tuKeDonTrong('Bạn phải ghi lại khoản này')).toContain('phải ');
    expect(tuKeDonTrong('Tháng sau nên bớt cà phê')).toContain('nên ');
    expect(tuKeDonTrong('Hãy đặt một mức đi')).toContain('hãy ');
    expect(tuKeDonTrong('Đừng tiêu quá tay')).toContain('đừng ');
    expect(tuKeDonTrong('Cần một hũ dự phòng')).toContain('cần ');
  });

  it('⭐⭐⭐ KHÔNG còn báo nhầm ở hệ từ phủ định/nghi vấn', () => {
    for (const cum of HE_TU_PHAI) {
      expect(tuKeDonTrong(`Đây ${cum} số dư tài khoản`), cum).toEqual([]);
    }
    expect(tuKeDonTrong('Sao là dấu của bạn, không phải xếp hạng của app.')).toEqual([]);
  });

  it('⭐⭐ che hệ từ KHÔNG được dán hai từ hai bên vào nhau', () => {
    /*
     * Nếu che bằng khoảng trắng thì "…đâu phải nên…" hoá "…đâu  nên…" — vô hại; nhưng
     * "khôngphải" kiểu dán ngược lại có thể nuốt mất một từ cấm nằm sát. Ký tự ngăn `·`
     * giữ hai bên rời nhau, nên một mệnh lệnh nấp ngay sau hệ từ VẪN bị bắt.
     */
    expect(tuKeDonTrong('Đây không phải hãy làm gì cả')).toContain('hãy ');
  });

  it('⭐⭐ "bộ nhớ tạm" KHÔNG bị bắt — `nhớ` ở đó là DANH TỪ', () => {
    /*
     * Ca thật, bắt được khi quét demo màn Cài đặt: nút CHÉP báo *"đã chép vào bộ nhớ
     * tạm"* — câu chuẩn của tiếng Việt cho clipboard. Bộ quét thô thấy `'nhớ '` và bắt.
     * Nếu không vá, người thi công sẽ viết tránh đi, và đó đúng là cái giá D292 đã ghi:
     * chốt A10 ép người viết làm câu chữ xấu đi.
     */
    expect(tuKeDonTrong('Mã đã chép vào bộ nhớ tạm')).toEqual([]);
    for (const c of CUM_KHONG_MENH_LENH) {
      expect(tuKeDonTrong(`Thứ này nằm trong ${c} của máy`), c).toEqual([]);
    }
  });

  it('⭐⭐ nhưng MỆNH LỆNH "nhớ" thật thì VẪN bị bắt', () => {
    // Vá phải hẹp: che một cụm, không che cả từ.
    expect(tuKeDonTrong('Nhớ ghi lại mã này')).toContain('nhớ ');
    expect(tuKeDonTrong('Chép vào bộ nhớ tạm rồi nhớ cất đi')).toContain('nhớ ');
  });

  it('⭐ bộ từ gốc KHÔNG bị đụng — vá nằm ở hàm quét, không ở danh sách', () => {
    // Mười ba chỗ khác trong repo vẫn `includes(tu)` thẳng trên `TU_KE_DON`.
    expect([...TU_KE_DON]).toContain('phải ');
    expect([...TU_KE_DON]).toHaveLength(8);
  });

  it('⭐⭐ mọi bảng ĐỀU được nối vào `moiChuoiPfm` — thêm bảng mà quên nối là bài này đỏ',
    async () => {
      /*
       * ⚠⚠ Đây là chốt của chốt. Bài quét A10 chỉ mạnh bằng cái hàm gom nó dựa vào; một
       * bảng mới không nối vào `moiChuoiPfm` thì nó **vô hình** với mọi bài ở trên, và
       * không có gì đỏ. Nên: lấy mọi export tên `CHU_*`/`O_CHU_*` bằng phản chiếu, rồi
       * đòi từng giá trị phải có mặt trong danh sách phẳng.
       */
      const mod = await import('../src/lib/pfm_chu') as Record<string, unknown>;
      const phang = new Set(moiChuoiPfm());
      const bang = Object.entries(mod).filter(([k, v]) =>
        /^(CHU|O_CHU)_/.test(k) && typeof v === 'object' && v !== null);
      expect(bang.length, 'không thấy bảng nào ⇒ phép lọc đã lạc').toBeGreaterThanOrEqual(10);

      for (const [ten, v] of bang) {
        for (const s of Object.values(v as Record<string, string>)) {
          expect(phang.has(s), `bảng ${ten} chưa được nối vào moiChuoiPfm() ("${s}")`)
            .toBe(true);
        }
      }
    });
});

describe('§II — ⭐⭐ PHỦ KÍN: thiếu một nhãn là lỗi BIÊN DỊCH, và cũng đỏ ở đây', () => {
  /*
   * ⚠ Kiểu `Record<Ma…, string>` đã bắt được thiếu nhãn lúc `tsc`. Bài dưới là lưới thứ
   * hai cho đúng một ca mà `tsc` không thấy: ai đó ép kiểu bằng `as` để "cho qua tạm".
   */
  const phuKin = (ten: string, mien: readonly string[], bang: Record<string, string>) => {
    it(`${ten}: đủ ${mien.length} nhãn, không thừa không thiếu`, () => {
      expect(Object.keys(bang).sort()).toEqual([...mien].sort());
      for (const k of mien) expect(bang[k]!.length, `${ten}.${k} rỗng`).toBeGreaterThan(0);
    });
  };

  phuKin('CHU_LOAI_CHI', SO_DANG_KY.y_loai.mien, CHU_LOAI_CHI);
  phuKin('O_CHU_LOAI_CHI', SO_DANG_KY.y_loai.mien, O_CHU_LOAI_CHI);
  phuKin('CHU_TU_LAP', SO_DANG_KY.ctx_tu_lap.mien, CHU_TU_LAP);
  phuKin('CHU_NGUON_THU', SO_DANG_KY.ctx_nguon_thu.mien, CHU_NGUON_THU);
  phuKin('CHU_KHUNG', SO_DANG_KY.ctx_khung.mien, CHU_KHUNG);
  phuKin('CHU_LOAI_HU', LOAI_HU, CHU_LOAI_CHI);
  phuKin('CHU_HAN', HAN_HU, CHU_HAN);
  phuKin('CHU_UU_TIEN', UU_TIEN_HU, CHU_UU_TIEN);
  phuKin('CHU_TRANG_THAI_HU', TRANG_THAI_HU, CHU_TRANG_THAI_HU);
  phuKin('CHU_CHUYEN_TIEP_HU', CHUYEN_TIEP_HU, CHU_CHUYEN_TIEP_HU);
  phuKin('CHU_TRANG_THAI_NGAY', TRANG_THAI_NGAY, CHU_TRANG_THAI_NGAY);
  phuKin('CHU_HANH_DONG_LUAT', HANH_DONG_LUAT, CHU_HANH_DONG_LUAT);
  phuKin('CHU_DIEU_KIEN', DIEU_KIEN, CHU_DIEU_KIEN);

  it('⭐ `LOAI_HU` và miền `y_loai` là CÙNG một danh mục — nên dùng chung một bảng', () => {
    // Hai danh sách trùng nhau từng phần tử; giữ hai bảng nhãn là hai bản sao sẽ trôi.
    expect([...LOAI_HU].sort()).toEqual([...SO_DANG_KY.y_loai.mien].sort());
  });
});

describe('§III — ô chữ pixel: chỗ giữ cho 12 lưới chưa vẽ', () => {
  it(`⭐ mỗi ô tối đa ${O_CHU_TOI_DA} ký tự — ô 36px Handjet không chứa hơn`, () => {
    // Một nhãn 5 chữ không vỡ layout ở máy tôi; nó vỡ ở máy người dùng.
    for (const [k, v] of Object.entries(O_CHU_LOAI_CHI)) {
      expect(v.length, `ô "${k}" dài ${v.length}`).toBeLessThanOrEqual(O_CHU_TOI_DA);
      expect(v, `ô "${k}" phải VIẾT HOA`).toBe(v.toUpperCase());
    }
  });

  it('ô chữ KHÁC nhãn đầy đủ — hai vai khác nhau, không gộp', () => {
    // Ô chữ là hình; nhãn đầy đủ là chữ cho trình đọc màn hình. Khi có art, ô đổi thành
    // lưới còn nhãn ở lại — nên chúng không được là cùng một chuỗi.
    for (const k of Object.keys(O_CHU_LOAI_CHI)) {
      expect(O_CHU_LOAI_CHI[k as keyof typeof O_CHU_LOAI_CHI])
        .not.toBe(CHU_LOAI_CHI[k as keyof typeof CHU_LOAI_CHI]);
    }
  });
});

describe('§IV — ⭐⭐ văn bản consent — BỐN CỬA (D295)', () => {
  it('⭐⭐ mọi văn bản trong `CONSENT_PHIEN_BAN` đều có câu chữ ở tự điển, và ngược lại', () => {
    /*
     * `config/pfm_consent.ts` viết rõ: *"SERVER CHỈ GIỮ ID + PHIÊN BẢN — câu chữ nằm ở tự
     * điển client"*. Một id đăng ký mà không có chữ là một văn bản pháp lý trỏ vào hư không.
     */
    // D329 — sổ phiên bản có thêm `buoi_do` (văn bản bàn buổi đo, chữ ở `buoi_do_chu.ts`, không phải một
    // cửa PFM). Tự điển PFM phải khớp ĐÚNG bốn văn bản cửa; phủ `buoi_do` là việc của `buoi_do_chu.test.ts`.
    const vanBanCuaPfm = CUA_PFM.map(vanBanCua);
    for (const id of vanBanCuaPfm) {
      expect(VAN_BAN_CONSENT[id], id).toBeDefined();
      expect(CONSENT_PHIEN_BAN[id], id).toBeDefined();
    }
    expect(Object.keys(VAN_BAN_CONSENT).sort()).toEqual([...vanBanCuaPfm].sort());
    // 0079 — thêm `nghien_cuu` (ô đồng ý nghiên cứu, chữ ở `nghien_cuu_chu.ts`, cũng không phải cửa PFM; phủ ở `buoi_do_chu.test.ts`).
    expect(Object.keys(CONSENT_PHIEN_BAN).filter((k) => !vanBanCuaPfm.includes(k as never))).toEqual(['buoi_do', 'nghien_cuu']);
    // Bốn cửa, đúng thứ tự "rời máy nhiều nhất" xuống "không gửi thêm gì".
    expect(CUA_PFM.map(vanBanCua)).toEqual(['pfm_ket', 'pfm_dac_trung', 'pfm_thuong', 'pfm_noi_game']);
  });

  it('⭐⭐ mỗi cửa đủ NĂM dòng, không dòng nào rỗng, và mỗi dòng NGẮN', () => {
    /*
     * Founder 06/09: *"đừng bắt user đọc nhiều, mỏi mắt lắm."* Bốn văn bản ngắn thay một
     * văn bản dài — và "ngắn" phải là một con số, không thì nó trôi theo từng lần thêm chữ.
     */
    for (const [id, v] of Object.entries(VAN_BAN_CONSENT)) {
      for (const [k, chu] of Object.entries(v)) {
        expect(chu.trim().length, `${id}.${k} rỗng`).toBeGreaterThan(0);
        expect(chu.length, `${id}.${k} dài ${chu.length} ký tự — quá 150`).toBeLessThanOrEqual(150);
      }
    }
  });

  it('⭐⭐⭐ két: nói ĐỦ HAI VẾ — có rời máy, VÀ máy chủ không mở được', () => {
    /*
     * ⚠⚠ Câu khó nhất của cả văn bản. Nói gọn thành "sổ không rời máy" là **sai sự thật**
     * (bản sao lưu có đi lên server); nói gọn thành "sổ được gửi lên server" là bỏ mất
     * đúng điều làm nó chấp nhận được. Hai vế phải cùng có mặt.
     */
    const k = VAN_BAN_CONSENT.pfm_ket;
    expect(k.roiMay).toMatch(/[Bb]ản sao/);
    expect(k.roiMay).toMatch(/khoá|mã hoá/);
    expect(k.mayChuKhongDoc, 'số tiền có nằm trong két, và két thì máy chủ không mở được')
      .toMatch(/[Ss]ố tiền/);
    expect(k.mayChuKhongDoc).toMatch(/không mở được|không đọc được/);
    expect(k.chot, 'mất mã là mất — không ai khôi phục hộ').toMatch(/[Mm]ất mã/);
  });

  it('⭐⭐⭐ nhãn vế hai KHÔNG ĐƯỢC là "ở lại máy" — số tiền CÓ rời máy, trong két', () => {
    /*
     * D294: bản đầu ghi "Những thứ Ở LẠI MÁY" rồi liệt kê "Số tiền của từng khoản chi" —
     * mà `ket.ts` khai `khoan: 'thang'`, tức số tiền nằm trong lát tháng được mã hoá rồi
     * đẩy lên `POST /pfm/luu`. Founder chốt 06/09: đổi nhãn. Bài này khoá quyết định ấy.
     */
    expect(CHU_CONSENT_KHOI.nhanKhongDoc.toLowerCase()).not.toMatch(/ở lại/);
    expect(CHU_CONSENT_KHOI.nhanKhongDoc.toLowerCase()).toMatch(/không đọc/);
    for (const v of Object.values(VAN_BAN_CONSENT)) {
      expect(v.mayChuKhongDoc.toLowerCase(), 'không dòng nào hứa "ở lại máy"').not.toMatch(/ở lại máy/);
    }
  });

  it('⭐⭐ đặc trưng: có câu mùa 0.0 (A11.16) và quyền xoá (P9 🔒)', () => {
    const d = VAN_BAN_CONSENT.pfm_dac_trung;
    expect(d.chot).toMatch(/không bán/);
    expect(d.chot).toMatch(/không chia/);
    expect(d.chot, 'phải nói xoá được dữ liệu đã gửi').toMatch(/xoá/);
    expect(d.mayChuKhongDoc, 'không số tiền, không tên hũ, không ghi chú').toMatch(/[Kk]hông một số tiền/);
  });

  it('⭐ thưởng: nói rõ chỉ NGÀY + TRẠNG THÁI rời máy, không số tiền', () => {
    const t = VAN_BAN_CONSENT.pfm_thuong;
    expect(t.roiMay).toMatch(/[Nn]gày/);
    expect(t.mayChuKhongDoc).toMatch(/không kèm số tiền/);
    expect(t.chot).toMatch(/[Tt]ắt/);
  });

  it('⭐ nối game: nói thẳng "không gửi thêm gì" — đây là QUYỀN DÙNG, không phải đường dữ liệu', () => {
    const n = VAN_BAN_CONSENT.pfm_noi_game;
    expect(n.roiMay).toMatch(/^Không gửi thêm gì/);
  });

  it('⭐⭐ nối game v2: chữ gọi tên ĐỦ thứ dây D324 ghép — thẻ, ba dấu, và từng mã gm_* gửi theo kỳ', () => {
    /*
     * v1 chỉ hứa "thẻ tính cách" trong khi dây ghép thêm năm chỉ số (A11.17 — consent không dẻo).
     * Bài này nối CHỮ với MÃ: thêm một mã `gm_*` mới vào `MA_CUA_SERVER` mà quên chữ là đỏ ở đây.
     */
    const n = VAN_BAN_CONSENT.pfm_noi_game;
    // Dòng luôn hiện gọi tên ba nhóm; tên từng chỉ số ở dòng chốt (mở bằng `?`).
    expect(n.roiMay).toMatch(/thẻ tính cách/);
    expect(n.roiMay).toMatch(/ba dấu kỹ năng/);
    expect(n.roiMay).toMatch(/năm chỉ số theo tháng/);
    const CHU_CUA_MA: Record<string, RegExp> = {
      gm_n_tran: /số trận/, gm_tk_giu: /giữ sổ tiết kiệm/, gm_tk_huy: /rút sớm/,
      gm_brier_tb: /độ khớp dự tính/, gm_phoi_nhiem: /phần vốn đặt vào thị trường/,
    };
    expect(MA_CUA_SERVER.filter((m) => m.startsWith('gm_')).sort()).toEqual(Object.keys(CHU_CUA_MA).sort());
    for (const [ma, chu] of Object.entries(CHU_CUA_MA)) expect(n.chot, ma).toMatch(chu);
  });

  it('⭐ mọi cửa: câu chốt nói được quyền TẮT', () => {
    for (const [id, v] of Object.entries(VAN_BAN_CONSENT)) {
      expect(v.chot, id).toMatch(/[Tt]ắt/);
    }
  });
});

describe('§V — ⭐⭐⭐ TỪ VỰNG HAI LOẠI HŨ: TIẾT KIỆM · CHI ở MỌI chỗ trên màn (founder 11/10, câu đóng 4 = A)', () => {
  /*
   * Chữ trên màn là TIẾT KIỆM / CHI; MÃ trong dữ liệu vẫn `tich_luy` / `tieu_dung` (đổi mã là đổi dữ liệu người dùng đã lưu — cấm).
   * Quét TOÀN BỘ tự điển (cùng nếp §I) + các câu lỗi hũ/tự chia mà người dùng đọc được.
   */
  const CU = /tích\s*lũy|tiêu\s*dùng/i;

  it('⭐⭐⭐ không chuỗi nào của tự điển còn nói TÍCH LŨY / TIÊU DÙNG — và có đối chứng dương: hai nhóm đã mang tên mới', () => {
    const tatCa = moiChuoiPfm();
    expect(tatCa).toContain('TIẾT KIỆM');
    expect(tatCa).toContain('CHI');
    for (const s of tatCa) expect(s, `"${s}" còn từ vựng cũ`).not.toMatch(CU);
  });

  it('⭐⭐ câu lỗi người dùng đọc được (hu.ts · tu_dong.ts) cũng không còn từ vựng cũ; mã dữ liệu giữ nguyên', () => {
    for (const f of ['../src/pfm/hu.ts', '../src/pfm/tu_dong.ts']) {
      const nguon = readFileSync(resolve(__dirname, f), 'utf8');
      const cau = [...nguon.matchAll(/new Loi(?:Hu|TuDong)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
      expect(cau.length, `${f}: quét được câu lỗi thật`).toBeGreaterThan(0);
      for (const c of cau) expect(c, `${f}: "${c}"`).not.toMatch(CU);
    }
    expect([...NHOM_HU]).toEqual(['tich_luy', 'tieu_dung']);
  });
});
