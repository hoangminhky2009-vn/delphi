/**
 * DIỆN MẠO — art, mã hoá chuỗi, và ĐƯỜNG CHẠY THẬT qua HTTP (D36).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NĂM THỨ FILE NÀY CỐ Ý *KHÔNG* LÀM, vì làm là kiểm rỗng:
 *
 * 1. KHÔNG `toBe(<số chép từ config>)`. Test chép lại hằng số thì nó kiểm chính
 *    nó. Ở đây kiểm QUAN HỆ (hộp bao ≤ trần · tỷ lệ phát sáng · chuỗi dựng lại
 *    được từ bảng dán) — quan hệ vẫn đúng khi ai đó chỉnh một con số cho hợp lý,
 *    và vỡ đúng lúc họ chỉnh một con số làm hỏng hình.
 *
 * 2. KHÔNG mock DB. Đường tiền không có ở tầng này nhưng đường TRANSACTION thì
 *    có (trừ kho + ghi dán + dựng chuỗi + ghi event phải cùng một transaction),
 *    mà mock transaction là kiểm một thứ không tồn tại.
 *
 * 3. KHÔNG chỉ kiểm "hàm render trả ra chuỗi". SỬA RỒI ĐO: dán một nhãn thì SVG
 *    phải KHÁC; dời một ô thì SVG phải KHÁC. Đây là phép thử rẻ nhất cho cái bẫy
 *    đã dính sáu lần ở repo này — code có, test có, mà không đường chạy nào gọi.
 *
 * 4. KHÔNG tin rằng "catalog và migration khớp nhau". Đọc CẢ HAI FILE và so.
 *
 * 5. KHÔNG kiểm "vĩnh viễn" bằng cách đọc code. D36 nói dán là không gỡ được —
 *    nên test THỬ XOÁ THẬT một dòng `avatar_dan` và đòi DB từ chối. Một lời hứa
 *    kiểm được bằng cách vi phạm nó mới là một lời hứa.
 *
 * 6. KHÔNG kiểm ĐUA ĐIỀU KIỆN bằng hai lượt gọi TUẦN TỰ. Lượt thứ hai khi ấy có
 *    snapshot mới nên nó XANH KỂ CẢ KHI CODE SAI — đúng loại "xanh rỗng" đắt nhất,
 *    vì nó dán nhãn an toàn lên chỗ duy nhất không an toàn. §6b ép các lượt CHỒNG
 *    nhau thật bằng một transaction thứ ba giữ khoá, rồi mới thả.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import {
  AVATAR_NEN, CATALOG_DIEN_MAO, chuoiTranTrui, DAN_TOI_DA, DIEN_MAO_MAC_DINH,
  DIEN_MAO_REGEX, docDienMao, GIA_BAN_SAO_THEM, KHUNG, MA_NEN, monPhaiSoHuu,
  NEN_TANG, NHAN_DAN, O_LUOI, soDan, VANH_KHUNG, vietDienMao,
} from '../config/avatar.js';
import {
  BANG_MAU_DOI, CATALOG_CAN_LUOI, LUOI_BOT, LUOI_DAN, LUOI_KHUNG, LUOI_NEN,
  MOI_LUOI_DIEN_MAO, veAvatarSVG, veBotSVG, veDanSVG,
} from '../config/avatar_art.js';
import { BANG_MAU, O_PHAT_SANG } from '../config/pixel_luoi.js';
import { AvatarError, capBoKhoiDau, capSticker } from '../server/avatar.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, moCuaAdmin } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Hộp bao tối đa của một nhãn dán — quá cỡ này là một nhãn che gần hết mặt. */
const DAN_TOI_DA_RONG = 14;
const DAN_TOI_DA_CAO = 8;
/**
 * Trần RIÊNG cho sticker vinh danh hạng (nguon 'merit') — hình mẫu founder to hơn nhãn gacha (Tôm 25×13, Cá Voi
 * 17×23) và SPEC huy-hieu-hang-sticker bắt GIỮ NGUYÊN cỡ + dáng. Trần này = hộp bao của chính sáu hình mẫu; vượt nó
 * thì là hình mới phải qua founder, không phải cứ nới. Món gacha vẫn bị trần 14×8 ở trên (người dùng TIÊU tiền
 * T vào chúng, và cái họ tiêu vào là khuôn mặt chứ không phải mảng che nó).
 */
const DAN_VINH_DANH_TOI_DA_RONG = 25;
const DAN_VINH_DANH_TOI_DA_CAO = 23;

// ══════════════════════════ 1. LƯỚI ══════════════════════════

describe('1. LƯỚI PIXEL — mọi lá phải nằm trên lưới, không có ngoại lệ', () => {
  it('mọi lưới dùng đúng bảng màu đã có (R5: không đẻ hệ art thứ ba)', () => {
    for (const [id, luoi] of Object.entries(MOI_LUOI_DIEN_MAO)) {
      const laCanvas = id.startsWith('nen_') || id.startsWith('bot_') || id.startsWith('kh_');
      if (laCanvas) {
        expect(luoi.length, `${id}: số hàng`).toBe(O_LUOI);
        for (const h of luoi) expect(h.length, `${id}: số cột`).toBe(O_LUOI);
      }
      // Hình chữ nhật đặc: mọi hàng cùng độ dài. Hàng lệch = ô trôi sang chỗ khác
      // mà không lỗi biên dịch nào bắt được.
      const rong = luoi[0]!.length;
      for (const h of luoi) expect(h.length, `${id}: hàng lệch độ dài`).toBe(rong);
      for (const h of luoi) {
        for (const c of h) {
          expect(c === '.' || BANG_MAU[c] !== undefined, `${id}: ký tự lạ '${c}'`).toBe(true);
        }
      }
    }
  });

  it('ba nền PHỦ KÍN 100% và chừa TRỐNG vành 2 ô cho khung', () => {
    for (const ma of MA_NEN) {
      const luoi = LUOI_NEN[ma]!;
      for (let y = 0; y < O_LUOI; y += 1) {
        for (let x = 0; x < O_LUOI; x += 1) {
          const ch = luoi[y]![x]!;
          // Ô gạch kín: không ô trong suốt nào. Chính điều này làm khung có chỗ đứng.
          expect(ch, `nền ${ma}: ô trống ở (${y},${x})`).not.toBe('.');
          if (Math.min(x, y, O_LUOI - 1 - x, O_LUOI - 1 - y) < VANH_KHUNG) {
            // Vành khung chỉ được chứa ký tự NỀN, nếu không thì khung đè lên nét vẽ.
            expect(['K', 'k'], `nền ${ma}: vành khung bị vẽ đè ở (${y},${x})`).toContain(ch);
          }
        }
      }
    }
  });

  it('mặt người KHÔNG phát sáng (≤2%) và đủ sắc độ để đổ bóng (≥12 màu)', () => {
    for (const ma of MA_NEN) {
      const o = LUOI_NEN[ma]!.join('').split('');
      const sang = o.filter((c) => O_PHAT_SANG.has(c)).length;
      // Ngưỡng 25% của art thẻ vô dụng ở đây: nó cho phép cả cái mặt chói.
      expect(sang / o.length, `nền ${ma}: chói quá`).toBeLessThanOrEqual(0.02);
      // ≥12 sắc độ ⇒ buộc phải có mặt cong, không tô mảng phẳng kiểu 8-bit.
      expect(new Set(o).size, `nền ${ma}: quá ít sắc độ`).toBeGreaterThanOrEqual(12);
    }
  });

  it('ba nền KHÁC NHAU THẬT — không phải một hình sơn lại', () => {
    for (let i = 0; i < MA_NEN.length; i += 1) {
      for (let j = i + 1; j < MA_NEN.length; j += 1) {
        // Đo bằng SILHOUETTE (ô nào là nền / ô nào là chủ thể), không bằng màu:
        // hai lá cùng hình khác màu vẫn "khác" theo phép so chuỗi, nhưng ở 32px
        // chúng là một.
        const sil = (m: string) => LUOI_NEN[m]!
          .map((h) => [...h].map((c) => (c === 'K' || c === 'k' ? '.' : '#')).join('')).join('');
        expect(sil(MA_NEN[i]!), `${MA_NEN[i]} vs ${MA_NEN[j]}: cùng silhouette`)
          .not.toBe(sil(MA_NEN[j]!));
      }
    }
  });

  it('KHUNG chỉ được vẽ trong vành 2 ô — điều kiện để khung không đè mặt', () => {
    for (const [id, luoi] of Object.entries(LUOI_KHUNG)) {
      for (let y = 0; y < luoi.length; y += 1) {
        for (let x = 0; x < luoi[y]!.length; x += 1) {
          if (luoi[y]![x] === '.') continue;
          const sauVanh = Math.min(x, y, O_LUOI - 1 - x, O_LUOI - 1 - y);
          expect(sauVanh, `${id}: ô (${y},${x}) tràn khỏi vành`).toBeLessThan(VANH_KHUNG);
        }
      }
    }
  });

  it('nhãn dán nằm trong hộp bao đọc được — không món nào che gần hết mặt', () => {
    for (const mon of NHAN_DAN) {
      const luoi = LUOI_DAN[mon.id];
      expect(luoi, `${mon.id}: chưa có lưới`).toBeDefined();
      const merit = mon.nguon === 'merit';
      expect(luoi![0]!.length, `${mon.id}: rộng quá`)
        .toBeLessThanOrEqual(merit ? DAN_VINH_DANH_TOI_DA_RONG : DAN_TOI_DA_RONG);
      expect(luoi!.length, `${mon.id}: cao quá`)
        .toBeLessThanOrEqual(merit ? DAN_VINH_DANH_TOI_DA_CAO : DAN_TOI_DA_CAO);
      // Nhỏ hơn 3×3 thì ở 32px là một đốm, không phải một con tem.
      expect(luoi![0]!.length * luoi!.length, `${mon.id}: nhỏ quá`).toBeGreaterThan(9);
    }
  });
});

// ══════════════════ 2. CHUỖI DIỆN MẠO v2 ══════════════════

describe('2. CHUỖI v2 — dán tự do, mã hoá phải nghịch đảo được và chống được rác', () => {
  it('mặc định đúng dạng và giải ra nền A trần', () => {
    expect(DIEN_MAO_REGEX.test(DIEN_MAO_MAC_DINH)).toBe(true);
    const dm = docDienMao(DIEN_MAO_MAC_DINH);
    expect(dm.goc).toBe('A');
    expect(dm.khung).toBeNull();
    expect(dm.dan).toEqual([]);
  });

  it('viết → đọc là bất động ở MỌI nhãn, MỌI ô của lưới, cả lật', () => {
    for (const mon of NHAN_DAN) {
      for (const [x, y] of [[0, 0], [7, 3], [15, 15], [31, 31], [2, 29]] as const) {
        for (const lat of [false, true]) {
          const s = vietDienMao({
            goc: 'B', khung: KHUNG[0]!.id, dan: [{ mon: mon.id, x, y, lat }],
          });
          expect(DIEN_MAO_REGEX.test(s), `${mon.id}@${x},${y}: sai dạng`).toBe(true);
          const d = docDienMao(s).dan[0]!;
          expect(d.mon.id).toBe(mon.id);
          expect([d.x, d.y, d.lat]).toEqual([x, y, lat]);
          expect(docDienMao(s).khung?.id).toBe(KHUNG[0]!.id);
        }
      }
    }
  });

  it('THỨ TỰ DÁN được giữ nguyên — dán sau nằm sau trong chuỗi (và đè lên trên)', () => {
    const s = vietDienMao({
      goc: 'A',
      dan: [
        { mon: NHAN_DAN[0]!.id, x: 4, y: 4 },
        { mon: NHAN_DAN[1]!.id, x: 5, y: 5 },
        { mon: NHAN_DAN[2]!.id, x: 6, y: 6 },
      ],
    });
    expect(docDienMao(s).dan.map((d) => d.mon.id))
      .toEqual([NHAN_DAN[0]!.id, NHAN_DAN[1]!.id, NHAN_DAN[2]!.id]);
    expect(soDan(s)).toBe(3);
  });

  it('toạ độ NGOÀI lưới không mã hoá được — chặn ở dạng, không chờ lúc vẽ', () => {
    // 'w' base36 = 32, tức ô thứ 33 của một lưới 32 ô. Nếu regex nhận nó thì dữ
    // liệu bẩn nằm trong DB mãi mãi và chỉ "biến mất" lúc render.
    expect(DIEN_MAO_REGEX.test('2A0--01ww0')).toBe(false);
    // Và `vietDienMao` kẹp về lưới chứ không sinh ra chuỗi bẩn.
    const s = vietDienMao({ goc: 'A', dan: [{ mon: NHAN_DAN[0]!.id, x: 99, y: -4 }] });
    expect(DIEN_MAO_REGEX.test(s)).toBe(true);
    expect(docDienMao(s).dan[0]!.x).toBe(O_LUOI - 1);
    expect(docDienMao(s).dan[0]!.y).toBe(0);
  });

  it('trần số nhãn: quá `DAN_TOI_DA` thì chuỗi bị cắt, không phình payload', () => {
    const nhieu = Array.from({ length: DAN_TOI_DA + 12 },
      () => ({ mon: NHAN_DAN[0]!.id, x: 3, y: 3 }));
    const s = vietDienMao({ goc: 'A', dan: nhieu });
    expect(DIEN_MAO_REGEX.test(s)).toBe(true);
    expect(soDan(s)).toBe(DAN_TOI_DA);
  });

  it('chuỗi rác / null / chuỗi v1 cũ → LÁ MẶC ĐỊNH, không bao giờ ném', () => {
    for (const xau of [null, undefined, '', 'xxx',
      // Chuỗi v1 (19 ký tự, khe neo) PHẢI bị từ chối: đọc nó bằng luật v2 sẽ ra
      // vài nhãn dán ở toạ độ rác.
      '1A0--00000000000000',
      '3A0--', '2Z0--', '<svg onload=alert(1)>']) {
      expect(() => docDienMao(xau)).not.toThrow();
      expect(docDienMao(xau).goc).toBe('A');
      expect(docDienMao(xau).dan).toEqual([]);
    }
  });

  it('`monPhaiSoHuu` gồm KHUNG, KHÔNG gồm nhãn dán (dán rồi là tiêu, không còn sở hữu)', () => {
    const s = vietDienMao({
      goc: 'C', khung: KHUNG[1]!.id,
      dan: [{ mon: NHAN_DAN[0]!.id, x: 9, y: 12 }],
    });
    // Nếu nhãn dán nằm trong danh sách kiểm sở hữu thì người dán xong sẽ không
    // đeo nổi chính tác phẩm của mình — kho đã trừ, mà kiểm lại đòi phải còn.
    expect(monPhaiSoHuu(s)).toEqual([KHUNG[1]!.id]);
    expect(monPhaiSoHuu(DIEN_MAO_MAC_DINH)).toEqual([]);
  });

  it('`chuoiTranTrui` bỏ hết nhãn dán mà GIỮ nền và khung (chỗ cắm kiểm duyệt)', () => {
    const s = vietDienMao({
      goc: 'B', khung: KHUNG[0]!.id,
      dan: [{ mon: NHAN_DAN[0]!.id, x: 8, y: 8 }, { mon: NHAN_DAN[1]!.id, x: 3, y: 3 }],
    });
    const tran = chuoiTranTrui(s);
    expect(soDan(tran)).toBe(0);
    expect(docDienMao(tran).goc).toBe('B');
    expect(docDienMao(tran).khung?.id).toBe(KHUNG[0]!.id);
  });
});

// ══════════════════ 3. CATALOG · GIÁ · MIGRATION ══════════════════

describe('3. CATALOG — khai một món mà thiếu art, thiếu hàng DB hoặc sai cửa là VỠ BUILD', () => {
  it('mọi món trong catalog đều có lưới, và không lưới nào mồ côi', () => {
    for (const id of CATALOG_CAN_LUOI) {
      expect(LUOI_KHUNG[id] ?? LUOI_DAN[id], `${id}: thiếu lưới`).toBeDefined();
    }
    const ids = new Set(CATALOG_DIEN_MAO.map((m) => m.id));
    for (const id of [...Object.keys(LUOI_KHUNG), ...Object.keys(LUOI_DAN)]) {
      expect(ids.has(id), `${id}: art mồ côi (KB không ai thấy)`).toBe(true);
    }
  });

  it('D41: BA nền tặng, và áo trùm đầu là THƯỞNG LỘ TRÌNH — không còn bán bằng Q', () => {
    /*
     * ⚠ ĐỔI SO VỚI D36 (bản cũ: "ĐÚNG HAI nền tặng, áo trùm đầu là HÀNG BÁN 600 Q").
     * D41 (founder 27/07 tối) thêm lá ẨN DANH vào nhóm tặng và chuyển áo trùm đầu
     * sang phần thưởng lộ trình mùa.
     *
     * Kiểm theo QUAN HỆ chứ không theo con số: đếm `NEN_TANG` bằng `toHaveLength(3)`
     * là chép lại catalog, nên lần thêm lá thứ tư sẽ đỏ dù chẳng có gì sai. Thứ
     * đáng canh là ba BẤT BIẾN dưới đây — chúng vỡ thì mới thật sự có chuyện.
     */
    // 1. Nhóm tặng phải NHIỀU HƠN MỘT: một lá duy nhất thì `avatar_chon` lúc onboard
    //    không đo được GU (A1) — không có gì để chọn thì không có lựa chọn nào để đo.
    expect(NEN_TANG.length).toBeGreaterThan(1);

    // 2. Lá ẨN DANH phải MIỄN PHÍ. D25: app hiện mặt cho người lạ, nên quyền KHÔNG
    //    LỘ DIỆN không được bán — biến nó thành hàng là bán một thứ đáng ra không bán.
    const anDanh = AVATAR_NEN.find((n) => n.id === 'av_an_danh');
    expect(anDanh, 'thiếu lá ẩn danh — D41').toBeTruthy();
    expect(anDanh!.nguon).toBe('tang_khoi_dau');
    expect(anDanh!.gia_q, 'lá ẩn danh mà có giá là đã bán quyền giấu mặt').toBeNull();

    // 3. Áo trùm đầu RỜI KHỎI cửa Q hoàn toàn. Còn `gia_q` là còn một đường thu Q,
    //    tức nó vẫn nằm trong cán cân sink/phát mà D41 nói là đã rời khỏi.
    const trum = AVATAR_NEN.find((n) => n.id === 'av_ao_trum_dau')!;
    expect(trum.nguon, 'D41: thưởng lộ trình, không phải hàng shop').toBe('bp');
    expect(trum.gia_q, 'còn giá Q là còn nằm trong cán cân Q').toBeNull();
    expect(trum.phien_ban, 'vẫn là lá mùa 0.0, chỉ đổi cách lấy').toBe('Beta Access');

    // 4. Và KHÔNG nền nào còn bán bằng Q — nếu sau này founder mở lại thì test này
    //    đỏ, và đó đúng là lúc cần một quyết định chứ không phải một cú sửa lặng lẽ.
    expect(AVATAR_NEN.filter((n) => n.nguon === 'niem_yet_q')).toHaveLength(0);
  });

  it('MỖI MÓN ĐÚNG MỘT CỬA: `niem_yet_q` có giá, mọi cửa khác KHÔNG BAO GIỜ có giá', () => {
    /*
     * Nếu một món vừa bán bằng Q vừa rơi ra từ hộp T thì một lượt tiêu T trả ra
     * GIÁ TRỊ TÍNH BẰNG Q — mà Q chạm voucher thật, tức hộp T vừa thành hộp có
     * giá trị thật. Đó là cửa chết pháp lý mà luật ngẫu nhiên D16 dựng ra để
     * tránh, chỉ đi vòng qua một MÓN thay vì qua một XU.
     */
    for (const m of [...CATALOG_DIEN_MAO, ...AVATAR_NEN]) {
      if (m.nguon === 'niem_yet_q') expect(m.gia_q, `${m.id}: món Q thiếu giá`).toBeGreaterThan(0);
      else expect(m.gia_q, `${m.id}: món ngoài cửa Q mà có giá Q`).toBeNull();
    }
  });

  it('KHÔNG nhãn dán nào niêm yết Q — D16 chưa duyệt giá nào cho nhãn dán (A8.2)', () => {
    // Bản trước tự đặt "100 Q/nhãn" và ghi chú là lấy từ D16. D16 chỉ có ba giá:
    // gacha 100 T · skin 600 Q · khung 250 Q. Test này chặn con số tự nghĩ quay lại.
    // Hai cửa hợp lệ của nhãn dán: gacha T (không giá) hoặc MERIT (sticker vinh danh hạng — không cửa nào mua được).
    for (const n of NHAN_DAN) expect(['gacha_t', 'merit'], `${n.id}`).toContain(n.nguon);
    expect(KHUNG.every((k) => k.gia_q === 250)).toBe(true);
  });

  it('giá BẢN SAO THÊM chưa có — cố ý `null`, chờ founder chốt', () => {
    // Ghim để không ai lặng lẽ điền một con số vào rồi ship: đó là tham số kinh tế.
    expect(GIA_BAN_SAO_THEM).toBeNull();
  });

  it('regex trong config KHỚP TỪNG KÝ TỰ với CHECK MỚI NHẤT trong migrations', async () => {
    /*
     * ⚠ ĐỌC MIGRATION MỚI NHẤT, KHÔNG GHIM 0013.
     *
     * Bản cũ đọc thẳng `0013_avatar.sql`. D41 nới dải mã nền `[A-C]` → `[A-Z]` bằng
     * `0021_avatar_ma_nen.sql`, nên từ đó "0013" thôi là nguồn chân lý: DB thật chạy
     * theo migration CUỐI CÙNG đụng tới ràng buộc, không theo migration đầu tiên.
     * Ghim số hiệu là biến một test đồng bộ thành một test lỗi thời — nó sẽ đỏ đúng
     * lúc code ĐÚNG, và người ta sẽ sửa test thay vì sửa code.
     *
     * Điều cần canh vẫn nguyên: **regex trong config phải khớp từng ký tự với CHECK
     * đang có hiệu lực ở DB.** Lệch một ký tự là chuỗi hợp lệ ở tầng này bị tầng kia
     * từ chối — và ở đây nó biểu hiện thành "avatar mới lặng lẽ render ra hình lá A"
     * chứ không thành một lỗi đọc được.
     */
    /*
     * ⚠ BỎ COMMENT TRƯỚC KHI QUÉT. Migration 0021 GIẢI THÍCH bản vá bằng cách trích
     * chính regex CŨ trong phần chú thích, nên quét thô sẽ tóm trúng lời giải thích
     * thay vì câu lệnh — và test đỏ với một thông báo tố cáo nhầm chỗ.
     * `pixelui.test.tsx` đã dính đúng bẫy này (nó từng tự bắt chính docstring của
     * mình), nên ở đây lọc từ đầu.
     */
    const ten = (await readdir(path.join(ROOT, 'migrations')))
      .filter((f) => f.endsWith('.sql')).sort();
    let cuoi: string | null = null;
    let tepCuoi = '';
    for (const f of ten) {
      const tho = await readFile(path.join(ROOT, 'migrations', f), 'utf8');
      const sql = tho.split('\n').filter((d) => !d.trimStart().startsWith('--')).join('\n');
      // Lấy lần khớp CUỐI trong file: một migration có thể drop rồi add lại.
      const moi = [...sql.matchAll(/dien_mao ~ '([^']+)'/g)].at(-1);
      if (moi) { cuoi = moi[1]!; tepCuoi = f; }
    }
    expect(cuoi, 'không migration nào đặt CHECK regex cho dien_mao').not.toBeNull();
    expect(cuoi, `lệch với ${tepCuoi}`).toBe(DIEN_MAO_REGEX.source);

    const sql0013 = await readFile(path.join(ROOT, 'migrations/0013_avatar.sql'), 'utf8');
    expect(sql0013).toContain(`DEFAULT '${DIEN_MAO_MAC_DINH}'`);
  });

  it('mọi món catalog có hàng trong migration (FK cần hàng THẬT)', async () => {
    /*
     * Quét MỌI migration, không ghim 0013: sáu sticker vinh danh hạng (nguon 'merit') thêm hàng ở 0077, và ghim
     * một số hiệu là biến bài đồng bộ thành bài lỗi thời — đỏ đúng lúc code ĐÚNG (cùng bài học ở bài regex CHECK).
     */
    const sql = (await Promise.all((await readdir(path.join(ROOT, 'migrations')))
      .filter((f) => f.endsWith('.sql')).sort()
      .map((f) => readFile(path.join(ROOT, 'migrations', f), 'utf8')))).join('\n');
    for (const m of CATALOG_DIEN_MAO) {
      expect(sql.includes(`'${m.id}'`), `${m.id}: thiếu hàng cosmetic_items`).toBe(true);
    }
    const sql0013 = await readFile(path.join(ROOT, 'migrations/0013_avatar.sql'), 'utf8');
    // Lá bán phải có hàng; hai lá TẶNG thì KHÔNG — chúng không sở hữu được.
    expect(sql0013).toContain("'av_ao_trum_dau'");
    for (const n of NEN_TANG) expect(sql0013.includes(`'${n.id}'`), `${n.id}: không nên có hàng`).toBe(false);
  });

  it('bảng màu thay thế CỐ Ý RỖNG — chỗ đã chừa, tính năng chưa chạy', () => {
    expect(Object.keys(BANG_MAU_DOI)).toEqual([]);
  });
});

// ══════════════════ 4. RENDER — SỬA RỒI ĐO ══════════════════

describe('4. RENDER — cơ chế có CHẠY THẬT không (bẫy "code có mà không ai gọi")', () => {
  it('tất định: cùng chuỗi → cùng SVG, từng ký tự', () => {
    const s = vietDienMao({ goc: 'B', dan: [{ mon: NHAN_DAN[0]!.id, x: 9, y: 11 }] });
    expect(veAvatarSVG(s)).toBe(veAvatarSVG(s));
  });

  it('ĐỔI NỀN thì SVG ĐỔI — ba lá không render ra cùng một hình', () => {
    const svg = MA_NEN.map((ma) => veAvatarSVG(vietDienMao({ goc: ma })));
    expect(new Set(svg).size).toBe(MA_NEN.length);
  });

  it('DÁN NHÃN thì SVG ĐỔI — với TỪNG món trong catalog', () => {
    const tran = veAvatarSVG(DIEN_MAO_MAC_DINH);
    for (const mon of NHAN_DAN) {
      const s = vietDienMao({ goc: 'A', dan: [{ mon: mon.id, x: 10, y: 12 }] });
      expect(veAvatarSVG(s), `${mon.id} không chạy: SVG y hệt lá trần`).not.toBe(tran);
    }
  });

  it('DỜI MỘT Ô thì hình ĐỔI — toạ độ tự do là toạ độ THẬT, không phải cờ trang trí', () => {
    const mon = NHAN_DAN[0]!.id;
    const a = veAvatarSVG(vietDienMao({ goc: 'A', dan: [{ mon, x: 8, y: 12 }] }));
    const b = veAvatarSVG(vietDienMao({ goc: 'A', dan: [{ mon, x: 9, y: 12 }] }));
    const c = veAvatarSVG(vietDienMao({ goc: 'A', dan: [{ mon, x: 8, y: 13 }] }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('THỨ TỰ DÁN quyết định ai đè ai — đảo thứ tự thì hình khác', () => {
    const [m1, m2] = [NHAN_DAN[0]!.id, NHAN_DAN[2]!.id];
    const truoc = veAvatarSVG(vietDienMao({
      goc: 'A', dan: [{ mon: m1, x: 10, y: 12 }, { mon: m2, x: 11, y: 12 }],
    }));
    const sau = veAvatarSVG(vietDienMao({
      goc: 'A', dan: [{ mon: m2, x: 11, y: 12 }, { mon: m1, x: 10, y: 12 }],
    }));
    expect(truoc).not.toBe(sau);
  });

  it('LẬT NGANG đổi hình với món không đối xứng', () => {
    for (const mon of NHAN_DAN) {
      const doiXung = LUOI_DAN[mon.id]!.every((h) => h === [...h].reverse().join(''));
      if (doiXung) continue;
      const th = veAvatarSVG(vietDienMao({ goc: 'A', dan: [{ mon: mon.id, x: 9, y: 9 }] }));
      const lat = veAvatarSVG(
        vietDienMao({ goc: 'A', dan: [{ mon: mon.id, x: 9, y: 9, lat: true }] }));
      expect(lat, `${mon.id}: lật mà hình không đổi`).not.toBe(th);
    }
  });

  it('dán TRÀN MÉP thì phần tràn bị CẮT, không quấn sang cạnh kia', () => {
    // Quấn vòng là hành vi không ai đoán được: kéo ra mép phải thì nửa nhãn mọc ở
    // mép trái. Cắt thì đoán được.
    const s = vietDienMao({ goc: 'A', dan: [{ mon: NHAN_DAN[0]!.id, x: 30, y: 30 }] });
    expect(() => veAvatarSVG(s)).not.toThrow();
    expect(veAvatarSVG(s)).toContain(`viewBox="0 0 ${O_LUOI} ${O_LUOI}"`);
  });

  it('ĐỔI KHUNG thì SVG ĐỔI, và khung KHÔNG làm lá to ra', () => {
    const tran = veAvatarSVG(DIEN_MAO_MAC_DINH);
    for (const k of KHUNG) {
      const s = veAvatarSVG(vietDienMao({ goc: 'A', khung: k.id }));
      expect(s, `${k.id}: khung không chạy`).not.toBe(tran);
      // viewBox y nguyên: khung nới lưới ra là lưới 8 ghế nhảy theo việc đối thủ
      // mua gì — đúng lớp lỗi bố cục D27 vừa phải chữa.
      expect(s).toContain(`viewBox="0 0 ${O_LUOI} ${O_LUOI}"`);
    }
  });

  it('KHUNG vẽ SAU nhãn dán — một nhãn ném ra mép không che mất khung đã mua', () => {
    const k = KHUNG[0]!.id;
    const chiKhung = veAvatarSVG(vietDienMao({ goc: 'A', khung: k }));
    const khungVaDanOMep = veAvatarSVG(vietDienMao({
      goc: 'A', khung: k, dan: [{ mon: NHAN_DAN[1]!.id, x: 0, y: 0 }],
    }));
    // Vành phải còn nguyên: hai hình khác nhau ở phần giữa, nhưng cả hai đều còn
    // đủ ô khung. Đo bằng số ô của màu khung xuất hiện trong `d=`.
    expect(khungVaDanOMep).not.toBe(chiKhung);
    const demVanh = (svg: string) => (svg.match(/M0,0h/g) ?? []).length;
    expect(demVanh(khungVaDanOMep)).toBe(demVanh(chiKhung));
  });

  it('SVG gộp path theo màu — không phồng thành một phần tử mỗi ô', () => {
    const s = veAvatarSVG(vietDienMao({
      goc: 'C', khung: KHUNG[2]!.id, dan: NHAN_DAN.map((m, i) => ({ mon: m.id, x: i * 3, y: i * 3 })),
    }));
    const soPath = (s.match(/<path/g) ?? []).length;
    // Lá phủ kín 1.024 ô. Một `<path>` mỗi màu là ≤ số màu trong bảng; nếu ai đó
    // đổi sang một phần tử mỗi ô thì con số này nhảy lên hàng trăm và bàn 8 ghế
    // gánh gấp 8 lần trên đúng màn động nhất của app.
    expect(soPath).toBeLessThanOrEqual(Object.keys(BANG_MAU).length);
    expect(s).toContain('shape-rendering="crispEdges"');
  });

  it('KHÔNG blur / gradient / bo góc trong SVG (§XI)', () => {
    for (const ma of MA_NEN) {
      const s = veAvatarSVG(vietDienMao({ goc: ma, dan: [{ mon: NHAN_DAN[0]!.id, x: 9, y: 9 }] }));
      for (const cam of ['feGaussianBlur', 'Gradient', ' rx=', '<circle', 'opacity']) {
        expect(s.includes(cam), `lá ${ma} còn '${cam}'`).toBe(false);
      }
    }
  });

  it('xem trước một nhãn dán riêng lẻ ra SVG đúng cỡ lưới của nó', () => {
    for (const mon of NHAN_DAN) {
      const luoi = LUOI_DAN[mon.id]!;
      expect(veDanSVG(mon.id)).toContain(`viewBox="0 0 ${luoi[0]!.length} ${luoi.length}"`);
    }
    expect(veDanSVG('khong-co-mon-nay')).toBe('');
  });
});

// ══════════════════ 5. BOT PHẢI LỘ MẶT LÀ BOT (D25/R3) ══════════════════

describe('5. BOT — khác người ở HÌNH, không ở công nghệ render', () => {
  it('ba lưới bot khác nhau, và không lưới nào trùng một lá người', () => {
    expect(new Set(LUOI_BOT.map((l) => l.join('\n'))).size).toBe(LUOI_BOT.length);
    const nguoi = new Set(Object.values(LUOI_NEN).map((l) => l.join('\n')));
    for (const b of LUOI_BOT) expect(nguoi.has(b.join('\n'))).toBe(false);
  });

  it('bot KHÔNG dùng dải da ấm của người — đọc được ngay ở 32px', () => {
    const DA = new Set(['y', 'O', 'o', 'B']);
    for (const [i, b] of LUOI_BOT.entries()) {
      for (const h of b) {
        for (const c of h) expect(DA.has(c), `bot ${i} dùng màu da '${c}'`).toBe(false);
      }
    }
  });

  it('bot đối xứng trục dọc; người thì KHÔNG (lệch có chủ ý)', () => {
    const doiXung = (l: readonly string[]) => l.every((h) => h === [...h].reverse().join(''));
    for (const [i, b] of LUOI_BOT.entries()) expect(doiXung(b), `bot ${i}`).toBe(true);
    for (const ma of MA_NEN) {
      expect(doiXung(LUOI_NEN[ma]!), `lá ${ma} đối xứng → trông như máy`).toBe(false);
    }
  });

  it('bot băm theo DANH TÍNH: cùng nhãn → cùng mặt, khác nhãn → khác mặt', () => {
    expect(veBotSVG('Máy · Cá mập')).toBe(veBotSVG('Máy · Cá mập'));
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(veBotSVG)).size).toBeGreaterThan(1);
  });

  it('bot KHÔNG có đường nào tới khung/nhãn dán — `veBotSVG` chỉ nhận một chuỗi', () => {
    // Bất biến CẤU TẠO, không phải luật lọc: chữ ký hàm không có chỗ nào để nhét
    // diện mạo vào, nên "bot đeo kính" không viết ra được.
    expect(veBotSVG.length).toBe(1);
  });
});

// ══════════════════ 6. ĐƯỜNG CHẠY THẬT ══════════════════

describe('6. API — onboarding, bộ sưu tập, và DÁN VĨNH VIỄN', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let pool: pg.Pool;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({
      pool,
      mailer: new CapturingMailer(),
      appBaseUrl: 'https://dubao.test',
      secureCookie: false,
    });
  }, 180_000);
  afterAll(async () => { await db?.stop(); });

  const goi = (p: string, cookie: string, body?: unknown) =>
    app.request(`http://x${p}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /** User đã onboard + đã nhận bộ khởi đầu (fixture SQL không đi qua onboarding). */
  async function userCoBo(opts: { role?: 'user' | 'admin' } = {}) {
    const u = await createTestUser(pool, opts);
    // Cửa 2FA (0025): admin phải qua trước, kể cả khi thứ đang test là avatar.
    if (opts.role === 'admin') await moCuaAdmin(pool, u);
    const { avatarId } = await capBoKhoiDau(pool, u.userId, 'A');
    return { ...u, avatarId };
  }

  it('CATALOG mở cho khách — onboard phải vẽ được hai lá tặng TRƯỚC khi có hồ sơ', async () => {
    const r = await app.request('http://x/api/v1/avatar/catalog');
    expect(r.status).toBe(200);
    const j = await r.json() as { nen: unknown[]; nen_tang: string[]; mon: unknown[] };
    expect(j.nen).toHaveLength(AVATAR_NEN.length);
    expect(j.nen_tang).toEqual(NEN_TANG.map((n) => n.ma));
    expect(j.mon).toHaveLength(CATALOG_DIEN_MAO.length);
  });

  it('bộ khởi đầu = MỘT TẤM NỀN CHO MỖI LÁ TẶNG, và lá đã chọn là lá đang mặc', async () => {
    const u = await createTestUser(pool);
    await capBoKhoiDau(pool, u.userId, 'B');
    const j = await (await goi('/api/v1/avatar/me', u.cookie)).json() as {
      dien_mao: string; dang_mac: string | null;
      bo_suu_tap: { nen: string; seri: number; so_dan: number }[];
    };
    expect(j.bo_suu_tap.map((a) => a.nen).sort()).toEqual(NEN_TANG.map((n) => n.ma).sort());
    expect(j.bo_suu_tap.every((a) => a.seri === 1 && a.so_dan === 0)).toBe(true);
    expect(docDienMao(j.dien_mao).goc).toBe('B');
    expect(j.dang_mac).not.toBeNull();
  });

  it('ĐỔI TÁC PHẨM ĐANG MẶC → lưu THẬT vào DB và ghi event `cos_equip`', async () => {
    const u = await userCoBo();
    const { rows } = await pool.query(
      `SELECT avatar_id FROM avatar_so_huu WHERE user_id = $1 AND nen = 'B'`, [u.userId]);
    const r = await goi('/api/v1/avatar/mac', u.cookie, { avatar_id: String(rows[0].avatar_id) });
    expect(r.status).toBe(200);

    // Đo Ở DB, không đo ở response: response có thể đúng mà UPDATE không chạy.
    const { rows: uRows } = await pool.query(
      'SELECT dien_mao, avatar_dang_mac FROM users WHERE user_id = $1', [u.userId]);
    expect(docDienMao(uRows[0].dien_mao as string).goc).toBe('B');
    expect(String(uRows[0].avatar_dang_mac)).toBe(String(rows[0].avatar_id));
    const { rows: ev } = await pool.query(
      `SELECT 1 FROM events WHERE user_id = $1 AND action_type = 'cos_equip'`, [u.userId]);
    expect(ev).toHaveLength(1);
  });

  it('mặc tác phẩm CỦA NGƯỜI KHÁC → 404, không đổi gì', async () => {
    const a = await userCoBo();
    const b = await userCoBo();
    const { rows } = await pool.query(
      'SELECT avatar_id FROM avatar_so_huu WHERE user_id = $1 LIMIT 1', [b.userId]);
    const r = await goi('/api/v1/avatar/mac', a.cookie, { avatar_id: String(rows[0].avatar_id) });
    expect(r.status).toBe(404);
  });

  it('founder 02/08 — POST /avatar/goc (route từng KHÔNG TỒN TẠI, Profile bắn vào 404 câm): đổi gốc thật + cấp bù lá thiếu', async () => {
    const u = await userCoBo();
    const r1 = await goi('/api/v1/avatar/goc', u.cookie, { goc: 'B' });
    expect(r1.status).toBe(200);
    // Đo Ở DB — response đúng mà UPDATE không chạy là lớp lỗi đã gặp.
    const { rows: u1 } = await pool.query(
      'SELECT dien_mao FROM users WHERE user_id = $1', [u.userId]);
    expect(docDienMao(u1[0].dien_mao as string).goc).toBe('B');

    // Tài khoản mở TRƯỚC D41 chưa từng nhận lá ẨN DANH (D) — giả lập bằng cách
    // xoá, rồi chọn: cấp bù đúng MỘT tấm tang_khoi_dau (luật quà D42), mặc luôn.
    await pool.query(
      `DELETE FROM avatar_so_huu WHERE user_id = $1 AND nen = 'D'`, [u.userId]);
    const r2 = await goi('/api/v1/avatar/goc', u.cookie, { goc: 'D' });
    expect(r2.status).toBe(200);
    const { rows: d } = await pool.query(
      `SELECT nguon FROM avatar_so_huu WHERE user_id = $1 AND nen = 'D'`, [u.userId]);
    expect(d).toHaveLength(1);
    expect(d[0].nguon).toBe('tang_khoi_dau');

    // Mã bịa → 400 nói ra, không im lặng.
    const r3 = await goi('/api/v1/avatar/goc', u.cookie, { goc: 'Z' });
    expect(r3.status).toBe(400);
  });

  it('DÁN KHÔNG XÁC NHẬN → 400, và nhãn KHÔNG bị trừ (D36: hộp xác nhận)', async () => {
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_xu_vang', 1);
    const r = await goi('/api/v1/avatar/dan', u.cookie, {
      avatar_id: u.avatarId, sticker_id: 'st_xu_vang', x: 10, y: 10,
    });
    expect(r.status).toBe(400);
    const { rows } = await pool.query(
      'SELECT so_luong FROM kho_sticker WHERE user_id = $1', [u.userId]);
    expect(Number(rows[0].so_luong)).toBe(1);
  });

  it('DÁN KHI KHO RỖNG → 409, không ghi dòng dán nào', async () => {
    const u = await userCoBo();
    const r = await goi('/api/v1/avatar/dan', u.cookie, {
      avatar_id: u.avatarId, sticker_id: 'st_xu_vang', x: 10, y: 10, xac_nhan: true,
    });
    expect(r.status).toBe(409);
    const { rows } = await pool.query('SELECT 1 FROM avatar_dan WHERE user_id = $1', [u.userId]);
    expect(rows).toHaveLength(0);
  });

  it('DÁN THẬT: trừ kho · ghi dán · đổi chuỗi · ĐỔI HÌNH · ghi event — cùng một lượt', async () => {
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_kinh_ram', 1);
    const truoc = (await pool.query('SELECT dien_mao FROM users WHERE user_id = $1',
      [u.userId])).rows[0].dien_mao as string;

    const r = await goi('/api/v1/avatar/dan', u.cookie, {
      avatar_id: u.avatarId, sticker_id: 'st_kinh_ram', x: 9, y: 12, lat: false,
      xac_nhan: true, ms_can_nhac: 4200, so_lan_doi_cho: 3,
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { chuoi: string; con_lai: number };
    expect(j.con_lai).toBe(0);

    const { rows: kho } = await pool.query(
      'SELECT so_luong, tong_nhan FROM kho_sticker WHERE user_id = $1', [u.userId]);
    expect(Number(kho[0].so_luong)).toBe(0);
    expect(Number(kho[0].tong_nhan)).toBe(1);

    const { rows: dan } = await pool.query(
      'SELECT sticker_id, x, y, thu_tu FROM avatar_dan WHERE user_id = $1', [u.userId]);
    expect(dan).toHaveLength(1);
    expect([dan[0].sticker_id, dan[0].x, dan[0].y, dan[0].thu_tu]).toEqual(['st_kinh_ram', 9, 12, 1]);

    const sau = (await pool.query('SELECT dien_mao FROM users WHERE user_id = $1',
      [u.userId])).rows[0].dien_mao as string;
    expect(sau).toBe(j.chuoi);
    expect(sau).not.toBe(truoc);
    // Và nó phải RA HÌNH KHÁC — dán mà không đổi hình thì dán để làm gì.
    expect(veAvatarSVG(sau)).not.toBe(veAvatarSVG(truoc));

    const { rows: ev } = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'sticker_dan'`,
      [u.userId]);
    expect(ev).toHaveLength(1);
    expect(ev[0].value_json.nhan).toBe('st_kinh_ram');
    expect(ev[0].value_json.ms).toBe(4200);
    expect(ev[0].value_json.doi_cho).toBe(3);
    // Ngân sách A7: snapshot phải GỌN.
    expect(JSON.stringify(ev[0].value_json).length).toBeLessThan(300);
  });

  it('DÁN LÀ VĨNH VIỄN — DB TỪ CHỐI xoá/sửa dòng dán (không phải luật trong code)', async () => {
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_ria_mep', 1);
    await goi('/api/v1/avatar/dan', u.cookie, {
      avatar_id: u.avatarId, sticker_id: 'st_ria_mep', x: 13, y: 17, xac_nhan: true,
    });
    await expect(pool.query('DELETE FROM avatar_dan WHERE user_id = $1', [u.userId]))
      .rejects.toThrow();
    await expect(pool.query('UPDATE avatar_dan SET x = 0 WHERE user_id = $1', [u.userId]))
      .rejects.toThrow();
    const { rows } = await pool.query('SELECT 1 FROM avatar_dan WHERE user_id = $1', [u.userId]);
    expect(rows).toHaveLength(1);
  });

  it('MỘT NHÃN CHỈ DÁN ĐƯỢC MỘT LẦN — lượt thứ hai 409 (vật tiêu hao, không phải mở khoá)', async () => {
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_xu_vang', 1);
    const body = {
      avatar_id: u.avatarId, sticker_id: 'st_xu_vang', x: 4, y: 4, xac_nhan: true,
    };
    expect((await goi('/api/v1/avatar/dan', u.cookie, body)).status).toBe(200);
    expect((await goi('/api/v1/avatar/dan', u.cookie, body)).status).toBe(409);
  });

  it('TÁC PHẨM CŨ GIỮ NGUYÊN NHÃN khi làm tác phẩm mới — mỗi lá là một tác phẩm riêng', async () => {
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_canh_bao', 2);
    await goi('/api/v1/avatar/dan', u.cookie, {
      avatar_id: u.avatarId, sticker_id: 'st_canh_bao', x: 3, y: 20, xac_nhan: true,
    });
    const { rows } = await pool.query(
      `SELECT avatar_id FROM avatar_so_huu WHERE user_id = $1 AND nen = 'B'`, [u.userId]);
    await goi('/api/v1/avatar/mac', u.cookie, { avatar_id: String(rows[0].avatar_id) });

    const j = await (await goi('/api/v1/avatar/me', u.cookie)).json() as {
      bo_suu_tap: { avatar_id: string; so_dan: number; chuoi: string }[];
    };
    const cu = j.bo_suu_tap.find((a) => a.avatar_id === String(u.avatarId))!;
    const moi = j.bo_suu_tap.find((a) => a.avatar_id === String(rows[0].avatar_id))!;
    expect(cu.so_dan).toBe(1);            // lá cũ GIỮ nhãn đã dán
    expect(moi.so_dan).toBe(0);           // lá mới trắng tinh
    expect(cu.chuoi).not.toBe(moi.chuoi);
  });

  it('CHUỖI LƯU = CHUỖI DỰNG LẠI TỪ BẢNG DÁN (một bản sao, không phải nguồn thứ hai)', async () => {
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_mui_ten_len', 2);
    for (const [x, y] of [[5, 6], [20, 21]]) {
      await goi('/api/v1/avatar/dan', u.cookie, {
        avatar_id: u.avatarId, sticker_id: 'st_mui_ten_len', x, y, xac_nhan: true,
      });
    }
    const { rows } = await pool.query(
      `SELECT a.nen, a.khung_id, a.chuoi,
              COALESCE(json_agg(json_build_object('mon', d.sticker_id, 'x', d.x, 'y', d.y,
                'lat', d.lat) ORDER BY d.thu_tu) FILTER (WHERE d.dan_id IS NOT NULL), '[]') AS dan
         FROM avatar_so_huu a LEFT JOIN avatar_dan d ON d.avatar_id = a.avatar_id
        WHERE a.avatar_id = $1 GROUP BY a.avatar_id`, [u.avatarId]);
    const dungLai = vietDienMao({
      goc: rows[0].nen, khung: rows[0].khung_id, dan: rows[0].dan,
    });
    expect(rows[0].chuoi).toBe(dungLai);
  });

  it('KHUNG: chưa sở hữu → 409; sở hữu rồi → lắp được và THÁO RA được', async () => {
    const u = await userCoBo();
    const k = KHUNG[0]!.id;
    expect((await goi('/api/v1/avatar/khung', u.cookie,
      { avatar_id: u.avatarId, khung_id: k })).status).toBe(409);

    await pool.query(
      `INSERT INTO user_cosmetics (user_id, cosmetic_id, source) VALUES ($1, $2, 'shop_q')`,
      [u.userId, k]);
    const r = await goi('/api/v1/avatar/khung', u.cookie, { avatar_id: u.avatarId, khung_id: k });
    expect(r.status).toBe(200);
    expect(docDienMao((await r.json() as { chuoi: string }).chuoi).khung?.id).toBe(k);
    // Khung là đồ ĐEO, không tiêu hao: tháo ra phải được.
    const r2 = await goi('/api/v1/avatar/khung', u.cookie,
      { avatar_id: u.avatarId, khung_id: null });
    expect(docDienMao((await r2.json() as { chuoi: string }).chuoi).khung).toBeNull();
  });

  it('ADMIN trao nhãn: người thường 403; admin thì vào kho THẬT', async () => {
    const thuong = await userCoBo();
    const admin = await userCoBo({ role: 'admin' });
    const than = { user_id: thuong.userId, sticker_id: 'st_niem_beta', so_luong: 2 };

    expect((await goi('/api/v1/admin/avatar/tang', thuong.cookie, than)).status).toBe(403);
    expect((await goi('/api/v1/admin/avatar/tang', admin.cookie, than)).status).toBe(200);

    const { rows } = await pool.query(
      `SELECT so_luong FROM kho_sticker WHERE user_id = $1 AND sticker_id = 'st_niem_beta'`,
      [thuong.userId]);
    expect(Number(rows[0].so_luong)).toBe(2);
    const { rows: au } = await pool.query(
      `SELECT 1 FROM admin_audit WHERE action = 'avatar_tang'`);
    expect(au.length).toBeGreaterThan(0);
  });

  it('GIỚI HẠN PHÁT HÀNH: hết bản thì cửa phát TỪ CHỐI (món độc quyền D36)', async () => {
    const admin = await userCoBo({ role: 'admin' });
    const u = await userCoBo();
    // `gioi_han` để NULL trong migration (chờ founder chốt số). Bật tạm ở đây để
    // chứng minh cơ chế CHẠY THẬT — nếu chỉ có cột mà không ai đếm thì "cực hiếm"
    // là một lời hứa suông.
    const daPhat = (await pool.query(
      `SELECT COALESCE(SUM(tong_nhan), 0) AS n FROM kho_sticker WHERE sticker_id = 'st_niem_beta'`
    )).rows[0].n;
    await pool.query(
      `UPDATE cosmetic_items SET gioi_han = $1 WHERE cosmetic_id = 'st_niem_beta'`,
      [Number(daPhat) + 1]);
    try {
      expect((await goi('/api/v1/admin/avatar/tang', admin.cookie,
        { user_id: u.userId, sticker_id: 'st_niem_beta', so_luong: 1 })).status).toBe(200);
      expect((await goi('/api/v1/admin/avatar/tang', admin.cookie,
        { user_id: u.userId, sticker_id: 'st_niem_beta', so_luong: 1 })).status).toBe(409);
    } finally {
      await pool.query(
        `UPDATE cosmetic_items SET gioi_han = NULL WHERE cosmetic_id = 'st_niem_beta'`);
    }
  });

  it('ẨN tác phẩm (kiểm duyệt): nhãn dán ngừng hiện, NỀN vẫn còn, dòng dán KHÔNG mất', async () => {
    const admin = await userCoBo({ role: 'admin' });
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_khau_trang', 1);
    await goi('/api/v1/avatar/dan', u.cookie, {
      avatar_id: u.avatarId, sticker_id: 'st_khau_trang', x: 11, y: 15, xac_nhan: true,
    });

    const r = await goi('/api/v1/admin/avatar/an', admin.cookie, { avatar_id: u.avatarId });
    expect(r.status).toBe(200);
    const { rows } = await pool.query('SELECT dien_mao FROM users WHERE user_id = $1', [u.userId]);
    expect(soDan(rows[0].dien_mao as string)).toBe(0);
    expect(docDienMao(rows[0].dien_mao as string).goc).toBe('A');   // vẫn còn khuôn mặt
    // Lịch sử KHÔNG bị xoá: ẩn ≠ xoá (xoá là mất dữ liệu, hoàn là mint — A3.4).
    const { rows: dan } = await pool.query(
      'SELECT 1 FROM avatar_dan WHERE avatar_id = $1', [u.avatarId]);
    expect(dan).toHaveLength(1);

    // Bỏ ẩn thì nhãn quay lại — không phải dựng lại từ đầu.
    await goi('/api/v1/admin/avatar/an', admin.cookie, { avatar_id: u.avatarId, an: false });
    const { rows: sau } = await pool.query(
      'SELECT dien_mao FROM users WHERE user_id = $1', [u.userId]);
    expect(soDan(sau[0].dien_mao as string)).toBe(1);
  });

  it('`/avatar/me` KHÔNG nhận `user_id` — không có bề mặt tra cứu người khác', async () => {
    const a = await userCoBo();
    const b = await createTestUser(pool);
    await capBoKhoiDau(pool, b.userId, 'B');
    for (const p of ['/api/v1/avatar/me', `/api/v1/avatar/me?user_id=${b.userId}`]) {
      const j = await (await goi(p, a.cookie)).json() as { dien_mao: string };
      expect(docDienMao(j.dien_mao).goc).toBe('A');
    }
  });

  /** Đăng ký → xác minh → đăng nhập → onboard. Đường THẬT, không tiêm SQL. */
  async function onboardThat(avatarGoc: string, ms?: number) {
    const email = `ob_${Math.random().toString(36).slice(2, 9)}@test.local`;
    const mailer = new CapturingMailer();
    const a2 = createApp({ pool, mailer, appBaseUrl: 'https://dubao.test', secureCookie: false });
    const post = (path: string, body: unknown, cookie?: string) => a2.request(`http://x${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    expect((await post('/api/v1/auth/register',
      { email, password: 'matkhaudaikinhkhung1', birth_year: 2005 })).status).toBe(202);
    const token = /token=([A-Za-z0-9_-]+)/.exec(mailer.last()!.text)![1]!;
    expect((await post('/api/v1/auth/verify-email', { token })).status).toBe(200);
    const login = await post('/api/v1/auth/login', { email, password: 'matkhaudaikinhkhung1' });
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;

    const ob = await post('/api/v1/onboarding', {
      handle: `ob${Math.random().toString(36).slice(2, 8)}`,
      age_band: '18-22', region: 'bac', occupation_band: 'hs_sv',
      research_consent: true, avatar_goc: avatarGoc,
      ...(ms === undefined ? {} : { avatar_ms: ms }),
    }, cookie);
    expect(ob.status).toBe(201);
    return (await ob.json() as { user_id: string }).user_id;
  }

  it('ONBOARDING THẬT qua HTTP: chọn lá → đủ tấm nền khởi đầu + event `avatar_chon`', async () => {
    // Chỉ ở đây mới kiểm được rằng quà khởi đầu nằm CÙNG transaction với hồ sơ.
    const userId = await onboardThat('B', 3100);
    const { rows } = await pool.query(
      'SELECT nen FROM avatar_so_huu WHERE user_id = $1 ORDER BY nen', [userId]);
    expect(rows.map((r) => r.nen)).toEqual(NEN_TANG.map((n) => n.ma));
    const { rows: u } = await pool.query(
      'SELECT dien_mao, avatar_dang_mac FROM users WHERE user_id = $1', [userId]);
    expect(docDienMao(u[0].dien_mao as string).goc).toBe('B');
    expect(u[0].avatar_dang_mac).not.toBeNull();
    const { rows: ev } = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'avatar_chon'`,
      [userId]);
    expect(ev[0].value_json).toMatchObject({ goc: 'B', tu_chon: true, ms_can_nhac: 3100 });
  });

  // ═══════════ 6b. ĐUA ĐIỀU KIỆN — hai cửa phát CHỒNG NHAU THẬT ═══════════
  //
  // Cả hai phép thử dưới đây dựng cùng một cái bẫy: một transaction thứ ba GIỮ KHOÁ
  // trên đúng dòng mà cửa phát sẽ khoá, thả các lượt phát vào cho chúng xếp hàng,
  // rồi mới nhả. Vì snapshot của một câu lệnh được chụp lúc câu lệnh BẮT ĐẦU (chứ
  // không phải lúc nó lấy được khoá), mọi lượt xếp hàng đều mang snapshot CŨ HƠN
  // commit của lượt thắng — tức điều kiện đua được TÁI HIỆN TẤT ĐỊNH, không phải
  // rình bằng cách chạy nhiều lần cho may.
  //
  // Đây cũng là lý do phép thử phải khẳng định CÓ NGƯỜI XẾP HÀNG (`doiChen` ném khi
  // không ai chờ): nếu các lượt chạy nối đuôi nhau thì bài kiểm này rỗng.

  /** Đợi tới khi đủ `n` câu lệnh đang XẾP HÀNG trên một khoá. Ném nếu không ai chờ. */
  async function doiChen(giu: pg.PoolClient, n: number): Promise<void> {
    for (let i = 0; i < 400; i += 1) {
      // Hỏi bằng CHÍNH kết nối đang giữ khoá: pool test chỉ có 5 slot, và phép thử
      // này đã tiêu gần hết. Một kết nối phụ để đi hỏi là một kết nối có thể không
      // xin được, và khi đó test treo thay vì đỏ.
      const { rows } = await giu.query(
        'SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted');
      if (Number(rows[0].n) >= n) return;
      await new Promise((r) => { setTimeout(r, 25); });
    }
    throw new Error('không lượt nào xếp hàng — phép thử đồng thời này đang RỖNG');
  }

  it('CẤP PHÁT CHỒNG NHAU trên bản CUỐI CÙNG: đúng MỘT lượt qua, tổng phát không vượt', async () => {
    /*
     * D36: sticker độc quyền "số lượng cực ít, cực hiếm". Lời hứa đó chỉ có giá trị
     * nếu nó đứng vững đúng lúc nhiều người cùng bấm — mọi lúc khác thì cột
     * `gioi_han` chưa bị thử.
     */
    const MON = 'st_niem_beta';
    const daPhat = async () => Number((await pool.query(
      `SELECT COALESCE(SUM(tong_nhan), 0)::int AS n FROM kho_sticker WHERE sticker_id = $1`,
      [MON])).rows[0].n);

    const truoc = await daPhat();
    // `gioi_han` trong migration để NULL (chờ founder chốt số — A8.2). NULL thì
    // KHÔNG CÓ GÌ ĐỂ TRANH, nên phải tự đặt một giới hạn nhỏ rồi mới đo.
    await pool.query('UPDATE cosmetic_items SET gioi_han = $2 WHERE cosmetic_id = $1',
      [MON, truoc + 1]);
    const users = await Promise.all(Array.from({ length: 3 }, () => createTestUser(pool)));

    const giu = await pool.connect();
    let chay: Promise<string[]> | undefined;
    try {
      await giu.query('BEGIN');
      await giu.query('SELECT 1 FROM cosmetic_items WHERE cosmetic_id = $1 FOR UPDATE', [MON]);

      // Mỗi người MỘT kết nối, MỘT transaction thật — không mô phỏng.
      chay = Promise.all(users.map(async (u) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await capSticker(client, u.userId, MON, 1);
          await client.query('COMMIT');
          return 'ok';
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          if (e instanceof AvatarError) return e.code;
          throw e;
        } finally {
          client.release();
        }
      }));

      await doiChen(giu, users.length);
      await giu.query('ROLLBACK');
      const ketQua = await chay;

      expect(ketQua.filter((x) => x === 'ok')).toHaveLength(1);
      // Hai lượt còn lại phải bị TỪ CHỐI RÕ RÀNG, không phải im lặng không nhận:
      // một lượt phát thất bại mà không nói vì sao là một lượt phát sẽ bị thử lại.
      expect(ketQua.filter((x) => x === 'het_ban_phat_hanh')).toHaveLength(2);
      // Bất biến thật sự quan trọng: TỔNG ĐÃ PHÁT không bao giờ vượt giới hạn.
      expect(await daPhat()).toBe(truoc + 1);
    } finally {
      await giu.query('ROLLBACK').catch(() => {});
      giu.release();
      await chay?.catch(() => {});
      await pool.query('UPDATE cosmetic_items SET gioi_han = NULL WHERE cosmetic_id = $1',
        [MON]);
    }
  }, 60_000);

  it('DÁN CHỒNG NHAU lên CÙNG tác phẩm: cả hai vào, thứ tự 1 rồi 2', async () => {
    /*
     * Cùng lớp lỗi, hậu quả khác: `so_dan` đọc bằng snapshot cũ thì lượt thứ hai
     * tính ra `thu_tu` TRÙNG lượt đầu và chết ở UNIQUE (avatar_id, thu_tu) — tức
     * 500 giữa một thao tác D36 nói là KHÔNG HOÀN TÁC ĐƯỢC. Nhãn không mất (cùng
     * transaction, rollback sạch) nhưng người chơi thấy app vỡ đúng lúc căng nhất.
     */
    const u = await userCoBo();
    await capSticker(pool, u.userId, 'st_xu_vang', 1);
    await capSticker(pool, u.userId, 'st_ria_mep', 1);

    const giu = await pool.connect();
    let chay: Promise<Response[]> | undefined;
    try {
      await giu.query('BEGIN');
      await giu.query('SELECT 1 FROM avatar_so_huu WHERE avatar_id = $1 FOR UPDATE',
        [u.avatarId]);

      chay = Promise.all(['st_xu_vang', 'st_ria_mep'].map((id, i) =>
        goi('/api/v1/avatar/dan', u.cookie, {
          avatar_id: u.avatarId, sticker_id: id, x: 4 + i, y: 6, xac_nhan: true,
        })));

      await doiChen(giu, 2);
      await giu.query('ROLLBACK');
      const rs = await chay;

      expect(rs.map((r) => r.status)).toEqual([200, 200]);
      const { rows } = await pool.query(
        'SELECT thu_tu FROM avatar_dan WHERE avatar_id = $1 ORDER BY thu_tu', [u.avatarId]);
      expect(rows.map((r) => Number(r.thu_tu))).toEqual([1, 2]);
      // Và chuỗi đọc-nhanh phải mang ĐỦ hai nhãn: lượt sau dựng lại chuỗi từ bảng
      // dán nên nó phải thấy cả lượt trước.
      const { rows: uRows } = await pool.query(
        'SELECT dien_mao FROM users WHERE user_id = $1', [u.userId]);
      expect(soDan(uRows[0].dien_mao as string)).toBe(2);
    } finally {
      await giu.query('ROLLBACK').catch(() => {});
      giu.release();
      await chay?.catch(() => {});
    }
  }, 60_000);

  it('KHÔNG chọn được lá BÁN lúc onboard — hàng ở shop không phát không', async () => {
    // 'C' là lá Beta Access 600 Q. Server phải rơi về lá tặng đầu tiên và ghi
    // `tu_chon: false`, chứ không phát không một món bán.
    const userId = await onboardThat('C');
    const { rows } = await pool.query(
      'SELECT nen FROM avatar_so_huu WHERE user_id = $1 ORDER BY nen', [userId]);
    expect(rows.map((r) => r.nen)).toEqual(NEN_TANG.map((n) => n.ma));
    const { rows: u } = await pool.query(
      'SELECT dien_mao FROM users WHERE user_id = $1', [userId]);
    expect(docDienMao(u[0].dien_mao as string).goc).toBe(NEN_TANG[0]!.ma);
    const { rows: ev } = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'avatar_chon'`,
      [userId]);
    expect(ev[0].value_json.tu_chon).toBe(false);
  });
});
