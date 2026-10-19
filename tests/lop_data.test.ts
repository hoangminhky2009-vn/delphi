/**
 * PHÂN LOẠI DATA THEO CỠ MAP × VAI (D178) — founder 30/08: *"chú ý luôn phần
 * thu data theo mỗi map và role (VD map 8 thì áp lực thời gian, role cá mập thì
 * có vốn nhiều) cho 1 loại data khác nhau. Phân loại rõ vào"*.
 *
 *   §I   TAXONOMY — mọi cỡ map/vai đang chạy đều có lớp; trục cấm thắng trục cho.
 *   §II  ⭐⭐ LUẬT ĐỌC — hoàn cảnh ÉP thì lớp đó KHÔNG đo được trục tương ứng
 *        (cá mập/tổ chức không đo khẩu vị tự do; map 8 không đo đọc chu kỳ).
 *   §III DÂY — dòng hành vi chở hai khoá cắt; hồ sơ KHAI mix, không trộn im lặng.
 *   §IV  RANH — server không trả chữ tiếng Việt (luật 2 của `insight.ts`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HOLDEM_DECISIONS, LOP_THEO_CO_MAP, LOP_THEO_VAI, lopData,
} from '../config/holdem.js';
import { VAI_TAT_CA } from '../server/holdem/vai.js';
import { mixLopData, type VongInsight } from '../server/holdem/insight.js';

const vong = (soO: number | null, vai: string | null): VongInsight => ({
  match_id: 'm', lenh: [], pnl_bp: 0, brier: null, brier_v: null,
  mo_bang: false, o_su_kien: false, la_tin_gia: false, chuoi_tang: false,
  tu_dong: false, cho_bp: null, tien_mat_bp: null, so_ma: null,
  ...(soO !== null ? { so_o: soO } : {}),
  ...(vai !== null ? { vai } : {}),
} as unknown as VongInsight);

describe('I. Taxonomy phủ đúng thứ đang chạy', () => {
  it('⭐ mọi cỡ map chơi được đều có lớp; mọi vai đều có lớp', () => {
    for (const size of HOLDEM_DECISIONS.CO_MAP_CHON) {
      expect(LOP_THEO_CO_MAP[size], `cỡ map ${size} chưa phân loại`).toBeTruthy();
    }
    for (const v of VAI_TAT_CA) {
      expect(LOP_THEO_VAI[v], `vai ${v} chưa phân loại`).toBeTruthy();
    }
  });

  it('không lớp nào vừa CHO vừa CẤM cùng một trục — bảng tự mâu thuẫn là đọc sai cả mùa', () => {
    for (const [ten, lop] of [...Object.entries(LOP_THEO_CO_MAP),
      ...Object.entries(LOP_THEO_VAI)]) {
      for (const t of lop.khong_do_duoc) {
        expect(lop.hop_le_cho, `${ten}: trục ${t} nằm cả hai phía`).not.toContain(t);
      }
    }
  });
});

describe('II. ⭐⭐ Luật đọc — hoàn cảnh ép thì không đo được', () => {
  it('⭐⭐ ghế CÁ MẬP không bao giờ là bằng chứng "khẩu vị tự do" (vốn ×3 + ghim Đòn Bẩy)', () => {
    for (const size of HOLDEM_DECISIONS.CO_MAP_CHON) {
      const l = lopData(size, 'ca_map');
      expect(l.hop_le_cho, `map ${size} + cá mập vẫn đo khẩu vị tự do`)
        .not.toContain('khau_vi_tu_do');
      expect(l.khong_do_duoc).toContain('khau_vi_tu_do');
    }
  });

  it('⭐⭐ map 8 không đo "đọc chu kỳ" — trận không có chu kỳ để mà đọc (D176)', () => {
    expect(lopData(8, null).hop_le_cho).not.toContain('doc_chu_ky');
    expect(lopData(8, null).hop_le_cho).toContain('quyet_khi_gap');
    // map 16 thì ngược lại: có chu kỳ, nhưng không ép ai quyết vội.
    expect(lopData(16, 'ca_nhan').hop_le_cho).toContain('doc_chu_ky');
    expect(lopData(16, 'ca_nhan').hop_le_cho).not.toContain('quyet_khi_gap');
  });

  it('⭐⭐ MỌI tổ hợp: trục CẤM không bao giờ lọt vào danh sách HỢP LỆ', () => {
    /*
     * ⚠ Bài này thay một bài XANH VÌ LÝ DO SAI (bắt được bằng tiêm lỗi): bản
     * đầu canh "vế trừ" của `lopData` bằng cặp map-12 × tổ chức, nhưng phép
     * GIAO đã loại `ky_luat_von` trước khi vế trừ chạy ⇒ gỡ vế trừ vẫn xanh.
     * Nay canh đúng thứ PHẢI đúng và kiểm TOÀN BỘ lưới tổ hợp: kết quả không
     * bao giờ vừa hợp lệ vừa bị cấm, dù luật ghép có đổi cách cài đặt.
     */
    const vaiDs: (string | null)[] = [...VAI_TAT_CA, null];
    let daKiem = 0;
    for (const size of [...HOLDEM_DECISIONS.CO_MAP_CHON, null]) {
      for (const v of vaiDs) {
        const l = lopData(size, v);
        for (const t of l.khong_do_duoc) {
          expect(l.hop_le_cho, `${l.ma}: trục ${t} vừa cấm vừa hợp lệ`).not.toContain(t);
        }
        daKiem += 1;
      }
    }
    expect(daKiem, 'lưới tổ hợp rỗng — bài không kiểm gì').toBe(vaiDs.length * 4);
    // Và ca thật đáng nhớ: mandate ép tổ chức đa dạng ⇒ không đo kỷ luật vốn.
    expect(LOP_THEO_VAI['to_chuc']!.khong_do_duoc).toContain('ky_luat_von');
    expect(lopData(12, 'to_chuc').hop_le_cho).not.toContain('ky_luat_von');
  });

  it('vắng vai (map 8 / trận cũ) vẫn phân loại được theo cỡ map', () => {
    expect(lopData(8, null).ma).toBe('8:khong_vai');
    expect(lopData(null, null).ma).toBe('?:khong_vai');
    expect(lopData(null, null).hop_le_cho).toEqual([]);
  });
});

describe('III. Dây — dòng chở khoá cắt, hồ sơ KHAI mix', () => {
  it('⭐⭐ hồ sơ khai ĐỦ mọi lớp, không cắt top-N, xếp theo số vòng', () => {
    const mix = mixLopData([
      vong(8, null), vong(8, null), vong(8, null),
      vong(12, 'ca_map'), vong(12, 'ca_map'),
      vong(16, 'ca_nhan'),
    ]);
    expect(mix).toEqual([
      { ma: '8:khong_vai', n_vong: 3 },
      { ma: '12:ca_map', n_vong: 2 },
      { ma: '16:ca_nhan', n_vong: 1 },
    ]);
  });

  it('dòng cũ (chưa có khoá cắt) vẫn vào mix với mã "?" — không rơi khỏi hồ sơ im lặng', () => {
    expect(mixLopData([vong(null, null), vong(8, null)]))
      .toEqual([{ ma: '8:khong_vai', n_vong: 1 }, { ma: '?:khong_vai', n_vong: 1 }]);
  });

  it('⭐ kho hành vi GHI hai cột và migration có khai', () => {
    const kho = readFileSync(resolve(process.cwd(), 'server/hanh_vi/kho.ts'), 'utf8');
    expect(kho, 'INSERT thiếu cột so_o/vai ⇒ kho không cắt được lớp').toMatch(/so_o, vai,/);
    expect(kho, 'vai phải đọc từ sơ đồ ĐÃ LƯU, không suy lại từ seed')
      .toContain('vaiChuTran');
    const mig = readFileSync(
      resolve(process.cwd(), 'migrations/0046_hanh_vi_lop_data.sql'), 'utf8');
    expect(mig).toContain('ADD COLUMN IF NOT EXISTS so_o');
    expect(mig).toContain('ADD COLUMN IF NOT EXISTS vai');
  });

  it('⭐ event `hd_match_start` TỰ MÔ TẢ cỡ map — kho event không cần join mới đọc được', () => {
    const api = readFileSync(resolve(process.cwd(), 'server/holdem_api.ts'), 'utf8');
    const khoi = api.split("'hd_match_start'")[1]!.slice(0, 1400);
    expect(khoi, 'match_start thiếu so_o ⇒ dòng event không tự nói được áp lực nào')
      .toMatch(/so_o: soO/);
  });
});

describe('IV. Ranh — server không trả chữ tiếng Việt (luật 2 của insight.ts)', () => {
  it('⭐ mix chỉ có `ma` + `n_vong`, không trường tên', () => {
    const mot = mixLopData([vong(8, null)])[0]!;
    expect(Object.keys(mot).sort()).toEqual(['ma', 'n_vong']);
    expect(JSON.stringify(mot)).not.toMatch(/[àáâãèéêìíòóôõùúăđĩũơưăạảấầẩẫậ]/i);
  });
});
