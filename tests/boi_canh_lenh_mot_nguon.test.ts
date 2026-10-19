/**
 * GATE — BỐI CẢNH LỆNH BOT CHỈ ĐƯỢC DỰNG Ở MỘT CHỖ (D386).
 *
 * ⚠⚠ VÌ SAO CÓ FILE NÀY: object `BoiCanhLenh` đã trôi BA LẦN, mỗi lần im lặng,
 * và lần nào cũng cùng một hậu quả — bàn đo chấm một con bot mà người chơi
 * không bao giờ gặp (D83):
 *   · `can_troi` v21↔v23 (rà soát 11/08) — bot chấm mã bằng bảng cũ;
 *   · ba cờ v42 (D311) — gate ra số GIỐNG HỆT lần trước khi nối, tới từng chữ
 *     số thập phân, vì bàn đo không đi qua `holdem_api.ts`;
 *   · `nen` v36 R3 — sống từ D166 tới D386 (17 phiên bản) mà không test nào đỏ.
 *
 * Hai tầng, và tầng thứ hai mới là tầng đáng giá: tầng §I đo HÀNH VI của cổng
 * (đúng/sai một cần gạt), tầng §II canh CẢ LỚP bằng cách đọc chính mã nguồn —
 * nó bắt được cả trường mà hôm nay chưa ai nghĩ ra. Một bài chỉ đếm các trường
 * ĐANG CÓ thì lần trôi thứ tư vẫn lọt y như ba lần trước.
 *
 * ⚠ §II BÓC CHÚ THÍCH TRƯỚC KHI QUÉT (tiền lệ D87): chính docstring giải thích
 * lệnh cấm có nhắc tên các trường bị cấm, nên quét thô là đỏ vì đoạn văn giải
 * thích chứ không vì mã — và một bài báo động giả thì sẽ bị nới cho qua, lúc đó
 * nó thôi canh gì (D79).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { luatCua } from '../config/holdem_balance.js';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { taoTran, type CongLuatTran } from '../server/holdem/engine.js';
import { boiCanhLenhVong } from '../server/holdem/nhip_lenh_bot.js';

const GHE = [0, 1, 2, 3, 4].map((i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));

/** Đi tới vòng đầu tiên có ô SỰ KIỆN — chỗ duy nhất `nen` có nghĩa. */
/**
 * D386 — NỀN ĐỂ KIỂM CỜ `botDocNen`: mặc định ĐANG CHẠY, ÉP Ô-NGỬA.
 * Cờ chỉ có nghĩa ở luật ô-ngửa (ở v53 bối cảnh bot đi nhánh ô kỳ vọng, không mang `nen`),
 * nên muốn thước đo này ĐO ĐƯỢC CỜ thì phải tắt `oUp`. Dựng từ mặc định thay vì gõ một khoá
 * cố định: khoá lạ ⇒ `luatCua` tắt hết cờ ⇒ hai vế giống hệt nhau ⇒ bài xanh rỗng (D58).
 */
const nenCo = (botDocNen: boolean): CongLuatTran =>
  ({ ...luatCua(HOLDEM_BALANCE_VERSION), oUp: false, botDocNen });

function vongTin(luat: CongLuatTran, seed: number) {
  const st = taoTran(seed, GHE, luat, 12);
  for (let v = 1; v <= st.map.o.length; v += 1) {
    if (st.map.o[v - 1]?.kind === 'su_kien') return { ...st, vong: v };
  }
  return null;
}

describe('§I — cổng `bot_doc_nen` bật/tắt đúng một trường', () => {
  it('v52 (trước D386): bối cảnh KHÔNG có `nen`, dù engine đang chồng nền', () => {
    let daThu = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = vongTin(luatCua('balance-v52-dadang'), seed);
      if (!st) continue;
      daThu += 1;
      expect(st.gia_chong_nen).toBe(true);
      expect(st.bot_doc_nen).toBeUndefined();
      expect(boiCanhLenhVong(st)).not.toHaveProperty('nen');
    }
    // Quét không ra ca nào thì bài này không chứng minh gì — tự đỏ (tiền lệ D103).
    expect(daThu).toBeGreaterThan(0);
  });

  it('cờ BẬT (mặc định đang chạy, ép ô-ngửa): bối cảnh CÓ `nen`, của đúng vòng đó', () => {
    let daThu = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = vongTin(nenCo(true), seed);
      if (!st) continue;
      // Chốt tự phát hiện: ngày nào mặc định thôi bật `giaChongNen` thì cả mục này mất
      // nghĩa — dòng này làm nó ĐỎ TO thay vì xanh rỗng.
      expect(st.gia_chong_nen).toBe(true);
      const nenThat = st.map.trang_thai?.[st.vong - 1]?.giai_doan_nen;
      if (nenThat === undefined) continue;
      daThu += 1;
      expect(st.bot_doc_nen).toBe(true);
      expect(boiCanhLenhVong(st)).toHaveProperty('nen', nenThat);
    }
    expect(daThu).toBeGreaterThan(0);
  });

  it('ô KHÔNG phải sự kiện thì không có `nen`, kể cả khi cờ bật', () => {
    const st = taoTran(7, GHE, nenCo(true), 12);
    const v = st.map.o.findIndex((o) => o.kind !== 'su_kien');
    expect(v).toBeGreaterThanOrEqual(0);
    expect(boiCanhLenhVong({ ...st, vong: v + 1 })).not.toHaveProperty('nen');
  });

  it('oracle giữ ô THẬT và KHÔNG nhận `ty_le_gia_bp` (không còn gì để chiết khấu)', () => {
    const st = vongTin(nenCo(true), 1)!;
    const thuong = boiCanhLenhVong(st)!;
    const oracle = boiCanhLenhVong(st, true)!;
    expect(oracle).toHaveProperty('biet_that_gia', true);
    expect(oracle).not.toHaveProperty('ty_le_gia_bp');
    expect(thuong).not.toHaveProperty('biet_that_gia');
    // Ô của ghế thường LUÔN bị bóc cờ tin giả; của oracle thì không.
    expect((thuong.o as { la_tin_gia?: boolean }).la_tin_gia).toBe(false);
    expect(oracle.o).toBe(st.map.o[st.vong - 1]);
  });

  it('⭐ D386 — ở luật Ô-ÚP (mặc định v53) cờ KHÔNG có tác dụng: nhánh ô kỳ vọng không mang `nen`', () => {
    /*
     * Hàm gom sinh ra TRƯỚC v53 nên chưa biết ô úp; khi gộp, nhánh `boiCanhUpCua` được dời VÀO
     * đây. Vế này khoá hai điều cùng lúc: (a) ở v53 bot chấm bằng Ô KỲ VỌNG (có `up`), không
     * đọc ô `o[vong−1]` như thể nó là ô tính tiền; (b) vì vậy `botDocNen` ở v53 là vô tác dụng —
     * ai định "bật cờ cho v53" phải đọc dòng này trước.
     */
    let daThu = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = vongTin({ ...luatCua(HOLDEM_BALANCE_VERSION), botDocNen: true }, seed);
      if (!st) continue;
      expect(st.o_up, 'mặc định thôi úp ô thì phải xem lại vế này').toBe(true);
      daThu += 1;
      const bc = boiCanhLenhVong(st);
      expect(bc, 'ở v53 bot phải có bối cảnh ô kỳ vọng').toHaveProperty('up');
      expect(bc).not.toHaveProperty('nen');
    }
    expect(daThu).toBeGreaterThan(0);
  });

  it('`bot_doc_tin` tắt ⇒ undefined ⇒ chính sách vòng tròn cũ, trận cũ replay nguyên', () => {
    const st = taoTran(1, GHE, {}, 12);
    expect(boiCanhLenhVong({ ...st, vong: 1 })).toBeUndefined();
  });
});

describe('§II — CẢ LỚP: không ai được dựng bối cảnh lệnh bằng tay nữa', () => {
  /** Bóc chú thích (block + dòng) — xem cảnh báo D87 ở đầu file. */
  const boChuThich = (x: string) => x
    .replace(/[/][*][^]*?[*][/]/g, '')
    .replace(/(^|[^:])[/][/][^\n]*/g, '$1');

  /**
   * NGƯỜI GỌI SUY TỪ CHÍNH CÂY MÃ, KHÔNG GÕ TAY.
   *
   * Danh sách gõ tay là danh sách sẽ teo: ai thêm một bàn đo mới thì nó nằm
   * ngoài lưới và không gì báo — đúng cái bẫy `SO_SEED` mà golden test đã phải
   * đi vá. Ở đây lưới tự rộng ra theo số người gọi `lenhBotNav`.
   */
  const NGUOI_GOI = execSync('git grep -l "lenhBotNav(" -- server scripts', { encoding: 'utf8' })
    .split('\n').map((x) => x.trim().replace(/\\/g, '/')).filter(Boolean)
    .filter((f) => f !== 'server/holdem/nhip_lenh_bot.ts' && f !== 'server/holdem/bots.ts');

  it('quét ra được người gọi — lưới rỗng thì bài này không canh gì', () => {
    expect(NGUOI_GOI.length).toBeGreaterThan(0);
  });

  /**
   * MỌI NGƯỜI GỌI `lenhBotNav` PHẢI LẤY BỐI CẢNH TỪ `boiCanhLenhVong`.
   *
   * Đây mới là bất biến thật, và nó bắt được cả trường mà hôm nay chưa ai nghĩ
   * ra: ai dựng tay thì thiếu đúng thứ vừa thêm, y như bốn lần đã xảy ra.
   */
  it.each(NGUOI_GOI)('%s lấy bối cảnh từ hàm chung', (f) => {
    const ma = boChuThich(readFileSync(f, 'utf8'));
    expect(ma, `${f} gọi lenhBotNav mà không gọi boiCanhLenhVong — dựng tay?`)
      .toContain('boiCanhLenhVong(');
  });

  /**
   * Lưới thứ hai: các trường CHỈ có nghĩa BÊN TRONG bối cảnh. `tran_ma_bp` CỐ Ý
   * không nằm đây — nó là phần PHỤ THUỘC GHẾ (mandate), theo thiết kế vẫn được
   * gộp ở chỗ gọi.
   */
  it.each(NGUOI_GOI)('%s không tự gõ các trường của bối cảnh', (f) => {
    const ma = boChuThich(readFileSync(f, 'utf8'));
    for (const d of ['biet_that_gia', 'ty_le_gia_bp']) {
      expect(ma, `${f} nhắc \`${d}\` ngoài chú thích — dựng bối cảnh bằng tay?`)
        .not.toContain(d);
    }
  });
});
