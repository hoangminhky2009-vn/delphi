/**
 * CHUỖI MỞ RỘNG v35 (D157) — cạnh nhân quả mới + cạnh nghe môi trường tiền tệ,
 * sau cổng `chuoiMoRong` (founder duyệt hướng 29/08: *"cải tiến và làm đa dạng
 * về cơ chế chuỗi thẻ và tác động giữa các thẻ, mô phỏng nền kinh tế thật"*).
 *
 * Bốn thứ được khoá:
 *   §I   CỔNG — false ở mọi entry lịch sử, true đúng một entry v35; mặc định
 *        repo CHƯA lật (founder lật sau MC — nếp D71/D72).
 *   §II  BẢNG — cờ tắt trả CHÍNH object bảng nền (===, bằng chứng cấu trúc);
 *        cờ bật gộp CỘNG DỒN; bảng nền không bị sửa thẳng.
 *   §III REPLAY — v35 = v34 + đúng HAI cần gạt (chuoiMoRong · duoi5): trung
 *        hoà hai cờ thì map giống từng byte; giữ nguyên thì phải KHÁC được
 *        (cơ chế sống, không phải trang trí — bẫy số 1 của repo).
 *   §IV  NGUỒN MỘT CỬA — không file nào ngoài config đọc thẳng bảng nền, trừ
 *        đúng MỘT chỗ: `nhanhHeQua` legacy (chỉ chạy ở trận ≤ v17).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, KE_TIEP_THEO_MOI_TRUONG,
  MT_KE_TIEP_MO_RONG, MT_SU_KIEN_KE_TIEP, heSoKeTiepMoiTruong, luatCua, mtKeTiep,
} from '../config/holdem.js';
import { taoTran, type GheMoi } from '../server/holdem/engine.js';
import { huongChinhSachKyVong } from '../server/holdem/map.js';

const ghe = (n: number): GheMoi[] => Array.from({ length: n }, (_, i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));

/** Chuỗi định danh map — đủ để phát hiện MỌI khác biệt cấu trúc ô. */
const kyMap = (seed: number, luat: Parameters<typeof taoTran>[2]) =>
  JSON.stringify(taoTran(seed, ghe(4), luat, 12).map);

describe('I. Cổng — lịch sử tắt, v35 bật, mặc định chưa lật', () => {
  it('⭐⭐ chuoiMoRong = false ở TỪNG entry trừ v35 — bật entry cũ là đổi map trận đã lưu', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      /*
       * ⚠ THƯỚC ĐÚNG LÀ "KHÔNG BẬT HỒI TỐ", KHÔNG PHẢI "CHỈ MỘT PHIÊN BẢN".
       * Bản đầu chốt `=== 'balance-v35-chuoi'`, nên MỖI LẦN thêm một
       * phiên bản kế thừa (v37…) là bài này đỏ dù không có gì hỏng — mà một bài
       * đỏ vì lý do sai thì sẽ bị nới bừa cho qua (D79). Điều thật sự phải giữ:
       * phiên bản CŨ HƠN mốc không bao giờ được bật, vì đó mới là cú đổi
       * replay của trận đã lưu.
       */
      const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
      const moc = soCua('balance-v35-chuoi');
      if (soCua(ten) < moc) {
        expect(luat.chuoiMoRong, `phiên bản CŨ "${ten}" bật cờ ⇒ đổi map trận đã lưu`)
          .not.toBe(true);
      } else {
        expect(luat.chuoiMoRong, `phiên bản "${ten}" từ mốc trở đi phải bật`).toBe(true);
      }
    }
    expect(luatCua('phien-ban-khong-ton-tai').chuoiMoRong, 'fallback phải TẮT').toBe(false);
  });

  it('⚠ v35 bật lại duoi5 — không bật thì 2/4 cạnh mới là cơ chế trang trí (D147)', () => {
    /*
     * chien_tranh→cam_van và tham_hoa→lam_phat cần 5 mặt đuôi SỐNG (duoi5
     * khoá trọng số đuôi về 0 khi tắt). Đây là ĐỀ XUẤT chờ founder chốt cùng
     * MC (D147-Q2); ai đổi phải đổi CÓ Ý THỨC — gỡ duoi5 thì gỡ luôn hai cạnh.
     */
    expect(luatCua('balance-v35-chuoi').duoi5).toBe(true);
  });

  it('mặc định repo KHÔNG BAO GIỜ lùi lại trước v42 — lớp dữ liệu VN đã lên', () => {
    /*
     * ⚠ BÀI NÀY TỪNG GHIM CHUỖI và phải sửa ở MỖI cú lật: v34 → v35 (D164) → v36
     * (D179) → v40 (D303) → v42 (D313) → v44 (D317). Năm lần sửa cho một bài, và
     * mỗi lần nó đỏ đúng lúc ai đó làm việc ĐÚNG. Bài như thế cuối cùng bị sửa
     * cho qua theo phản xạ, rồi bị xoá.
     *
     * Vế đáng giữ không phải "mặc định là chuỗi X" mà là KHÔNG LÙI: mọi cơ chế
     * dưới đây đã lên mặc định bằng một quyết định founder đứng trên bảng MC
     * 12.000×3, nên một cú lật lùi lại dưới v42 là gỡ chúng mà không ai bàn.
     * "Mặc định không đổi lặng lẽ" đã có golden canh chắc hơn nhiều (lật mà quên
     * ghim bản cũ là 120 hàng đổi hash).
     */
    const so = Number(/^balance-v(\d+)/.exec(HOLDEM_BALANCE_VERSION)?.[1] ?? 0);
    expect(so, `mặc định lùi về ${HOLDEM_BALANCE_VERSION}`).toBeGreaterThanOrEqual(42);
    // v42 xếp chồng v41 ⇒ lật nó là lớp dữ liệu VN lên mặc định cùng lúc.
    expect(luatCua(HOLDEM_BALANCE_VERSION).lopVn).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).taiSanV42).toBe(true);
  });
});

describe('II. Bảng — một cửa, gộp cộng dồn, nền bất khả xâm', () => {
  it('⭐⭐ cờ tắt trả CHÍNH object bảng nền (===) — trận cũ không trôi một bp nào', () => {
    expect(mtKeTiep(false)).toBe(MT_SU_KIEN_KE_TIEP);
    expect(mtKeTiep(undefined)).toBe(MT_SU_KIEN_KE_TIEP);
  });

  it('⭐ cờ bật: cạnh mới có mặt, cạnh trùng CỘNG DỒN, cạnh nền giữ nguyên', () => {
    const gop = mtKeTiep(true);
    expect(gop.bong_bong['tang_lai_suat']).toBe(2000);
    expect(gop.tham_hoa['lam_phat']).toBe(3000);
    // cạnh trùng: nền 300 + mở rộng 1200 = 1500 — gộp là CỘNG, không phải ĐÈ.
    expect(gop.chien_tranh['cam_van']).toBe(300 + 1200);
    // cạnh TỰ THÂN duy nhất — lạm phát dai dẳng.
    expect(gop.lam_phat['lam_phat']).toBe(1500);
    // cạnh nền không suy suyển khi đứng cạnh cạnh mới.
    expect(gop.chien_tranh['lam_phat']).toBe(4500);
    expect(gop.lam_phat['tang_lai_suat']).toBe(5000);
  });

  it('⭐ bảng NỀN không chứa cạnh mở rộng — ai "dọn cho gọn" bằng cách sửa thẳng là đỏ', () => {
    expect(MT_SU_KIEN_KE_TIEP.bong_bong['tang_lai_suat']).toBeUndefined();
    expect(MT_SU_KIEN_KE_TIEP.tham_hoa['lam_phat']).toBeUndefined();
    expect(MT_SU_KIEN_KE_TIEP.lam_phat['lam_phat']).toBeUndefined();
  });

  it('hệ số môi trường: đúng cặp đúng môi trường mới nhân, còn lại 10000', () => {
    expect(heSoKeTiepMoiTruong('lam_phat', 'tang_lai_suat', 'dat')).toBe(15000);
    expect(heSoKeTiepMoiTruong('lam_phat', 'tang_lai_suat', 'trung_tinh')).toBe(10000);
    expect(heSoKeTiepMoiTruong('ha_lai_suat', 'bong_bong', 're')).toBe(15000);
    expect(heSoKeTiepMoiTruong('ha_lai_suat', 'bong_bong', 'dat')).toBe(10000);
    expect(heSoKeTiepMoiTruong('chien_tranh', 'cam_van', 'dat')).toBe(10000);
    // Chỉ HAI luật — thêm là phải đo lại gate (D150), bài này bắt đếm lại.
    expect(KE_TIEP_THEO_MOI_TRUONG.length).toBe(2);
    // Mọi luật phải trỏ vào cạnh CÓ THẬT trong bảng gộp — luật lên cạnh ma
    // là hệ số nhân với 0, cơ chế trang trí ngay từ lúc viết.
    for (const r of KE_TIEP_THEO_MOI_TRUONG) {
      expect(mtKeTiep(true)[r.tu][r.den] ?? 0,
        `luật ${r.tu}→${r.den} trỏ cạnh không tồn tại`).toBeGreaterThan(0);
    }
  });
});

describe('III. Replay & cơ chế sống — cô lập TỪNG cần gạt', () => {
  it('⭐⭐ v35 trung hoà 4 cờ ⇒ map GIỐNG TỪNG BYTE map v34 — không cờ lậu nào khác', () => {
    // D158 thêm tuongTacThe (ĐỔ DẦU) · D159 thêm markovNguon — cả hai chạm máy sinh.
    const v34 = luatCua('balance-v34-vai');
    const v35TrungHoa = {
      ...luatCua('balance-v35-chuoi'),
      chuoiMoRong: false, duoi5: false, tuongTacThe: false, markovNguon: false,
    };
    for (const seed of [1, 7, 42, 99, 1234]) {
      expect(kyMap(seed, v35TrungHoa)).toBe(kyMap(seed, v34));
    }
  });

  it('⭐⭐ CÔ LẬP cần gạt chuỗi: v35 vs v35∖chuoiMoRong (duoi5 giữ) phải KHÁC được', () => {
    /*
     * Bài "sống" so v35 với v34 từng XANH GIẢ khi giết dây nghiêng chuỗi —
     * duoi5 một mình đã làm map khác (bẫy bàn-đo-rỗng, bắt được nhờ tiêm lỗi
     * D157). Phải so hai thế giới chỉ khác ĐÚNG MỘT cờ.
     */
    const v35 = luatCua('balance-v35-chuoi');
    const tatChuoi = { ...v35, chuoiMoRong: false };
    let khac = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      if (kyMap(seed, v35) !== kyMap(seed, tatChuoi)) khac += 1;
    }
    expect(khac, 'chuoiMoRong không đổi map nào — cờ không nối tới máy sinh').toBeGreaterThan(0);
  });

  it('cô lập duoi5: v35∖chuoiMoRong vs v34 phải KHÁC được (5 mặt đuôi sống lại)', () => {
    const v34 = luatCua('balance-v34-vai');
    const tatChuoi = { ...luatCua('balance-v35-chuoi'), chuoiMoRong: false };
    let khac = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      if (kyMap(seed, tatChuoi) !== kyMap(seed, v34)) khac += 1;
    }
    expect(khac).toBeGreaterThan(0);
  });
});

describe('IIIb. NHTW dập bong bóng — vế kỳ họp (đo D157 mới thấy phải đặt ở đây)', () => {
  /*
   * Cạnh rút-tự-do bong_bong→tang_lai_suat bị van ×0,2 ngoài-lịch đè gần chết
   * (đo 1500 seed: 0/2 ca) — "chính sách dồn về kỳ họp" là thiết kế v11, nên
   * phản ứng NHTW phải sống ở `huongChinhSachKyVong`. Đo: kỳ họp sau bong bóng
   * thật ra TĂNG 18,9% (cũ) → 56,6% (v35). Unit tất định khoá từng vế ưu tiên.
   */
  const gd = (g: string) => ({ kind: 'giai_doan', giai_doan: g }) as never;
  const sk = (id: string, gia = false) =>
    ({ kind: 'su_kien', su_kien: id, la_tin_gia: gia, bao_truoc: 'tang' }) as never;

  it('⭐⭐ bong bóng THẬT trong cửa sổ + chưa có lý do hạ ⇒ TĂNG (chỉ khi moRong)', () => {
    const cuaSo = [gd('tang'), sk('bong_bong'), gd('tang')];
    expect(huongChinhSachKyVong(cuaSo, 'tang', true)).toBe('tang');
    // Trận cũ (vắng cờ / cờ tắt) giữ nguyên GIỮ — replay không đổi.
    expect(huongChinhSachKyVong(cuaSo, 'tang')).toBe('giu');
    expect(huongChinhSachKyVong(cuaSo, 'tang', false)).toBe('giu');
  });

  it('⭐ bong bóng ĐÃ VỠ (pha giảm/sập trong cửa sổ) ⇒ HẠ thắng — NHTW cứu, không đạp thêm', () => {
    expect(huongChinhSachKyVong([sk('bong_bong'), gd('giam')], 'giam', true)).toBe('ha');
    expect(huongChinhSachKyVong([sk('bong_bong'), sk('hack_san')], 'tang', true)).toBe('ha');
  });

  it('bong bóng GIẢ không kéo được kỳ họp — tin giả mà kéo là lộ cờ qua chính sách', () => {
    expect(huongChinhSachKyVong([gd('tang'), sk('bong_bong', true)], 'tang', true)).toBe('giu');
  });

  it('lạm phát vẫn đứng TRÊN: đủ ngưỡng lạm phát thì tăng vì lạm phát, có hay không bong bóng', () => {
    const cuaSo = [sk('lam_phat'), sk('chien_tranh'), sk('bong_bong')];
    expect(huongChinhSachKyVong(cuaSo, 'tang', true)).toBe('tang');
    expect(huongChinhSachKyVong(cuaSo, 'tang', false)).toBe('tang');
  });
});

describe('IV. Nguồn một cửa — không ai đọc thẳng bảng nền ngoài legacy', () => {
  it('⭐ map/bảng-điện-tử/api: 0 lượt đọc thẳng; engine đúng 1 (nhanhHeQua ≤ v17)', () => {
    const dem = (f: string) => {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        .replace(/^\s*\*.*$/gm, '');
      return (src.match(/MT_SU_KIEN_KE_TIEP\[/g) ?? []).length;
    };
    expect(dem('server/holdem/map.ts'), 'map-gen đọc thẳng — cạnh v35 lọt vào trận cũ').toBe(0);
    expect(dem('server/holdem/bang_dien_tu.ts'), 'dự báo đọc thẳng').toBe(0);
    expect(dem('server/holdem_api.ts'), 'keo_theo đọc thẳng').toBe(0);
    /*
     * nhanhHeQua CHỈ chạy khi boNhanhHeQua tắt (trận ≤ v17) nên nó PHẢI đọc
     * bảng nền mãi mãi — cho nó đi qua mtKeTiep là vô hại hôm nay nhưng mở
     * cửa cho ai đó truyền true và đổi echo của trận cổ. Đúng MỘT, không hơn.
     */
    expect(dem('server/holdem/engine.ts'), 'engine phải còn ĐÚNG 1 (nhanhHeQua legacy)').toBe(1);
  });

  it('⭐ dây trong map-gen nối ĐỦ: 2 lượt mtKeTiep(coChuoiMoRong) + kỳ họp nhận cờ', () => {
    /*
     * Bắt đúng mũi tiêm đã LỌT lượt đầu (D157): đổi một lượt đọc thành
     * mtKeTiep(false) thì map v35 vẫn khác v34 qua duoi5/kỳ họp ⇒ bài hành vi
     * xanh giả. Quét nguồn đếm từng dây một.
     */
    const src = readFileSync(resolve(process.cwd(), 'server/holdem/map.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect((src.match(/mtKeTiep\(coChuoiMoRong\)/g) ?? []).length,
      'một lượt đọc rơi khỏi cổng — cạnh v35 chết im ở đúng chỗ đó').toBe(2);
    expect(src, 'kỳ họp không nhận cờ — NHTW quên mất bong bóng')
      .toContain('huongChinhSachKyVong(o, gdNenTruocLich, coChuoiMoRong)');
  });
});
