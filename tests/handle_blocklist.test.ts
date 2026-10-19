/**
 * Lọc tên hiển thị — D25/R2, pre-req cứng trước khi Market Hold'em hiện TÊN
 * cho người lạ.
 *
 * Test soi CẢ HAI CHIỀU, vì bản cũ hỏng cả hai:
 *   - chặn nhầm người vô tội (account/success/vaccine/london — do 'cc','lon'
 *     bị khớp như chuỗi con)
 *   - bỏ lọt toàn bộ từ tục tiếng Anh + leetspeak
 *
 * Bộ "phải cho qua" quan trọng ngang bộ "phải chặn": một bộ lọc chặn nhầm
 * `analyst` trong app tài chính là bộ lọc hỏng, dù nó chặn đúng mọi từ tục.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTH, HANDLE_BLOCK_EXACT, HANDLE_BLOCK_SUBSTRING,
  handleBlockReason, normalizeHandleForCheck,
} from '../config/auth.js';

/** Tên hợp lệ về định dạng — để test tập trung vào phần lọc nội dung. */
function wellFormed(h: string): boolean {
  return AUTH.HANDLE_PATTERN.test(h);
}

describe('PHẢI CHO QUA — chặn nhầm còn tệ hơn bỏ lọt', () => {
  const ok = [
    // Từng bị bản cũ chặn nhầm (đo được 19/07)
    'account', 'success', 'vaccine', 'london', 'soccer', 'dmitri', 'tomcc',
    // Từ nghiệp vụ của chính app tài chính — chặn mấy cái này là hỏng sản phẩm
    'analyst', 'analysis', 'assets', 'assetmanager', 'document', 'documents',
    // Chứa token tầng-từ nhưng là từ lành
    'grape', 'grapefruit', 'shoe', 'title', 'petition', 'constitution',
    'passion', 'classic', 'cassette',
    // Tên người dùng bình thường tiếng Việt
    'minh_dev', 'hoangminh', '7chodenchoi', 'lastkiss4you', 'nhadautu',
    'chungkhoan', 'catuong', 'nhadaututre',
  ];
  for (const h of ok) {
    it(`"${h}" phải qua`, () => {
      expect(wellFormed(h), 'định dạng').toBe(true);
      expect(handleBlockReason(h), `bị chặn bởi token "${handleBlockReason(h)}"`).toBeNull();
    });
  }
});

describe('PHẢI CHẶN — tục / thù ghét / khiêu dâm', () => {
  const bad = [
    // Đang SỐNG trên prod lúc phát hiện — chính là ca thúc đẩy R2
    'suckmydik',
    // Tiếng Anh thẳng
    'fuckyou', 'bitch', 'nigger', 'pussycat', 'porn_king', 'bigcock',
    'whore', 'slutty', 'faggot', 'sexgod', 'rapist', 'pedobear',
    // Thù ghét
    'hitler88', 'nazi_boy',
    // Tiếng Việt viết tắt (nguyên tên hoặc nguyên một phần)
    // Token 2 ký tự ('dm','cc','ml') KHÔNG đăng ký được nguyên tên vì
    // HANDLE_PATTERN đòi ≥3 ký tự — chúng chỉ có tác dụng khi là một phần
    // tách bởi '_'. Test đúng dạng đó, không test dạng bất khả.
    'vcl', 'lon', 'dit', 'xx_lon_xx', 'abc_dmm', 'loz', 'toi_dm_ban', 'a_cc_b',
    // Tầng từ, đứng riêng
    'anal', 'ass', 'rape', 'cum', 'tit',
  ];
  for (const h of bad) {
    it(`"${h}" phải bị chặn`, () => {
      expect(wellFormed(h), 'định dạng').toBe(true);
      expect(handleBlockReason(h)).not.toBeNull();
    });
  }
});

describe('PHẢI CHẶN — lách bằng leetspeak và gạch dưới', () => {
  const bad = [
    'sh1t', 'd1ck', 'f4ggot', 'b1tch', 'n1gger', 'p0rn', 's3x',
    's_u_c_k_m_y', 'f_u_c_k', 'd_i_c_k', 'h1tler',
  ];
  for (const h of bad) {
    it(`"${h}" phải bị chặn`, () => {
      expect(wellFormed(h), 'định dạng').toBe(true);
      expect(handleBlockReason(h)).not.toBeNull();
    });
  }
});

describe('PHẢI CHẶN — mạo danh hệ thống', () => {
  // Chặn CẢ biến thể "vô hại" như dubao_fan: cho lọt là mở đường cho
  // dubao_hotro / delphi_support nhắn tin lừa người dùng. Fan không dùng được
  // tên app là cái giá bình thường — nền tảng nào cũng cấm.
  for (const h of ['admin', 'admin123', 'delphi_official', 'dubao', 'dubao_fan',
                   'moderator_1', 'system', 'support', 'root', 'mod', 'ceo']) {
    it(`"${h}" phải bị chặn`, () => {
      expect(handleBlockReason(h)).not.toBeNull();
    });
  }
});

describe('BẪY TIẾNG VIỆT — ghép âm tiết tạo ra từ cấm giả', () => {
  /**
   * Lớp lỗi bản đầu của tôi dính: gộp '_' VÔ ĐIỀU KIỆN trước khi quét chuỗi
   * con. Tiếng Việt viết tách âm tiết nên "nguoi_du_bao" -> "nguoidubao"
   * (dính 'dubao'), "nguoi_se_xinh" -> "nguoisexinh" (dính 'sex'). Test auth
   * cũ đỏ vì đúng ca này — tên `nguoi_du_bao`.
   */
  const phaiQua = [
    'nguoi_du_bao', 'du_bao_gia', 'nguoi_se_xinh', 'ho_tro_ky_thuat',
    'anh_hai_lua', 'co_be_ban_diem',
  ];
  for (const h of phaiQua) {
    it(`"${h}" là tên tiếng Việt bình thường — phải qua`, () => {
      expect(handleBlockReason(h), `bị chặn bởi "${handleBlockReason(h)}"`).toBeNull();
    });
  }

  it('nhưng tách TỪNG KÝ TỰ để lách thì vẫn bị bắt', () => {
    expect(handleBlockReason('s_u_c_k_m_y')).not.toBeNull();
    expect(handleBlockReason('f_u_c_k')).not.toBeNull();
  });

  it('và mạo danh thương hiệu vẫn bị bắt ở tầng TỪ', () => {
    expect(handleBlockReason('dubao_hotro')).not.toBeNull();
    expect(handleBlockReason('du_bao')).not.toBeNull();
    expect(handleBlockReason('delphi_support')).not.toBeNull();
  });
});

describe('Chuẩn hoá', () => {
  it('bỏ gạch dưới và quy số về chữ', () => {
    expect(normalizeHandleForCheck('s_h_1_t')).toBe('shit');
    expect(normalizeHandleForCheck('D1CK')).toBe('dick');
    expect(normalizeHandleForCheck('h3ll0')).toBe('hello');
  });
});

describe('Kỷ luật danh sách', () => {
  it('token tầng CHUỖI CON phải đủ dài (≥3) — ngắn hơn là chặn nhầm hàng loạt', () => {
    for (const t of HANDLE_BLOCK_SUBSTRING) {
      expect(t.length, `"${t}" quá ngắn cho tầng chuỗi con`).toBeGreaterThanOrEqual(3);
    }
  });

  it('không token nào nằm ở CẢ HAI tầng (thừa, và gây nhầm khi sửa)', () => {
    const trung = HANDLE_BLOCK_EXACT.filter((t) => HANDLE_BLOCK_SUBSTRING.includes(t));
    expect(trung, `token trùng hai tầng: ${trung.join(', ')}`).toEqual([]);
  });

  it('token tầng chuỗi con KHÔNG được nằm trong từ lành thông dụng', () => {
    // Lưới an toàn: thêm token mới mà đụng một trong các từ này thì test đỏ,
    // buộc người thêm phải chuyển nó xuống tầng TỪ.
    const tuLanh = [
      'account', 'analyst', 'analysis', 'assets', 'document', 'success',
      'vaccine', 'london', 'soccer', 'grape', 'shoe', 'title', 'passion',
      'classic', 'constitution', 'petition', 'market', 'trader', 'invest',
    ];
    for (const t of HANDLE_BLOCK_SUBSTRING) {
      const dung = tuLanh.filter((w) => w.includes(t));
      expect(dung, `token "${t}" đụng từ lành: ${dung.join(', ')}`).toEqual([]);
    }
  });
});
