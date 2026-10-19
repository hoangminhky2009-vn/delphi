/**
 * E24 — HỆ THỐNG KHÔNG TRẢ TIỀN CHO MÓN CHƯA TỪNG CÓ T ĐI VÀO.
 *
 * ⚠ Bài này sinh ra từ một lỗ ĐÃ MỞ TRÊN PROD (06/09, D291), tìm thấy khi thử
 * chợ trên dữ liệu thật: `Dấu niêm Beta` — quà tri ân beta, đã bị gỡ khỏi hộp
 * gacha từ 04/08 nên KHÔNG ai mua được bằng T — vẫn bán lại được ở giá epic
 * 600 T, tức 30% quỹ chợ trong một cú bấm.
 *
 * Nửa sau là bài canh chống hồi quy loại khác: hằng số `HE_THONG_MUA_LAI_DOC_BAN`
 * nằm im từ D258 mà KHÔNG ai đọc — một công tắc không nối vào đâu trông y hệt
 * một luật đang chạy.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HE_THONG_MUA_LAI_DOC_BAN } from '../config/battle_pass.js';
import { HOP_GACHA } from '../server/sandbox/ung_vien.js';
import { heThongMuaLai, lyDoKhongMuaLai } from '../server/kinh_te/mua_lai.js';

describe('E24 — món nào Hệ thống chịu trả tiền mua lại', () => {
  it('⭐ CA THẬT: `st_niem_beta` KHÔNG bán lại được', () => {
    expect(HOP_GACHA.some((m) => m.id === 'st_niem_beta'),
      'nếu ngày nào đó nó quay lại hộp thì bài này phải được đọc lại, không phải sửa cho xanh')
      .toBe(false);
    expect(heThongMuaLai('st_niem_beta')).toBe(false);
    expect(lyDoKhongMuaLai('st_niem_beta')).toBe('khong_ban_lai');
  });

  it('món BÌNH THƯỜNG trong hộp thì bán lại được — cổng không đóng nhầm cả chợ', () => {
    const trongHop = HOP_GACHA.filter((m) => m.loai === 'sticker');
    expect(trongHop.length, 'hộp rỗng thì bài dưới vô nghĩa').toBeGreaterThanOrEqual(4);
    for (const m of trongHop) {
      expect(heThongMuaLai(m.id), `${m.id} phải bán lại được`).toBe(true);
      expect(lyDoKhongMuaLai(m.id)).toBeNull();
    }
  });

  it('id lạ hoắc ⇒ fail-closed, không "chưa biết thì cho qua"', () => {
    expect(heThongMuaLai('mon_khong_ton_tai')).toBe(false);
    expect(heThongMuaLai('')).toBe(false);
  });

  it('cờ founder đang TẮT — đây là trạng thái bài trên mô tả', () => {
    expect(HE_THONG_MUA_LAI_DOC_BAN).toBe(false);
  });
});

describe('⭐ QUÉT MÃ NGUỒN — cửa BÁN phải hỏi E24, và hằng số phải có người đọc', () => {
  const GOC = process.cwd();

  it('`server/cho.ts` gọi cổng E24 ở thân hàm', () => {
    const nguon = readFileSync(join(GOC, 'server/cho.ts'), 'utf8')
      .split('\n').filter((d) => !/^\s*import/.test(d)).join('\n');
    expect(nguon, 'cửa bán không hỏi E24 ⇒ món phát miễn phí lại rút được quỹ')
      .toMatch(/heThongMuaLai\s*\(/);
  });

  it('⚠ `HE_THONG_MUA_LAI_DOC_BAN` phải được ĐỌC ở đường chạy, không chỉ ở sim', () => {
    /*
     * Từ D258 tới 06/09 hằng số này chỉ được đọc bởi `economy_sim` và test —
     * tức nó mô tả một luật mà không thi hành luật nào. Bài này khoá lại: phải
     * có ít nhất một tệp trong `server/` đọc nó.
     */
    const nguon = readFileSync(join(GOC, 'server/kinh_te/mua_lai.ts'), 'utf8');
    expect(nguon).toMatch(/HE_THONG_MUA_LAI_DOC_BAN/);
  });
});
