/**
 * BA LUẬT TƯƠNG TÁC THẺ v35 (D158) — ĐÚNG THUỐC · ĐỔ DẦU · CỘNG HƯỞNG TRÚ ẨN,
 * sau cổng `tuongTacThe` (founder duyệt hướng 29/08: *"tác động giữa các thẻ,
 * mô phỏng nền kinh tế thật"*; ba luật phác ở D150, giữ ĐÚNG BA).
 *
 *   §I   CỔNG — false mọi entry lịch sử, true đúng v35.
 *   §II  ĐÚNG THUỐC — unit tất định trên echoDangCo: tăng lãi THẬT dập dư âm
 *        lạm phát THẬT; thuốc giả không dập; thuốc TRƯỚC bệnh không dập.
 *   §III CỘNG HƯỞNG TRÚ ẨN — machEcho nhân vàng của hai nguồn trong cặp; cú
 *        đảo tin giả cũng bị nhân (mặt chữ, không rò cờ); helper dò cặp.
 *   §IV  DÂY NỐI — bbDoDau đủ 7 mắt; mọi đường server đọc echo qua echoCua;
 *        mọi lời machEcho mang cờ cộng hưởng.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BO_LUAT_THEO_PHIEN_BAN, MT_TAI_SAN_SU_KIEN, TUONG_TAC_THE, luatCua,
} from '../config/holdem.js';
import {
  coCongHuongTruAn, echoDangCo, machEcho, taoTran, type GheMoi,
} from '../server/holdem/engine.js';
import type { HoldemMap } from '../server/holdem/map.js';

const sk = (id: string, gia = false) =>
  ({ kind: 'su_kien', su_kien: id, la_tin_gia: gia, bao_truoc: 'tang' }) as never;
const gd = (g: string) => ({ kind: 'giai_doan', giai_doan: g }) as never;
const mapTay = (o: unknown[]): HoldemMap => ({ seed: 0, o }) as unknown as HoldemMap;
const ghe = (n: number): GheMoi[] => Array.from({ length: n }, (_, i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));

describe('I. Cổng', () => {
  it('⭐⭐ tuongTacThe = false ở TỪNG entry trừ v35 — bật entry cũ là đổi replay', () => {
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
        expect(luat.tuongTacThe, `phiên bản CŨ "${ten}" bật cờ ⇒ đổi map trận đã lưu`)
          .not.toBe(true);
      } else {
        expect(luat.tuongTacThe, `phiên bản "${ten}" từ mốc trở đi phải bật`).toBe(true);
      }
    }
    expect(luatCua('phien-ban-khong-ton-tai').tuongTacThe).toBe(false);
  });

  it('taoTran luồn cờ vào st — v35 bật, v34 vắng', () => {
    expect(taoTran(1, ghe(2), luatCua('balance-v35-chuoi'), 8).tuong_tac_the).toBe(true);
    expect(taoTran(1, ghe(2), luatCua('balance-v34-vai'), 8).tuong_tac_the).toBeUndefined();
  });
});

describe('II. ĐÚNG THUỐC — tăng lãi thật dập dư âm lạm phát', () => {
  // lam_phat THẬT ở ô 1, tang_lai_suat THẬT ở ô 2, đang đứng vòng 3:
  // cả hai đều trong cửa sổ echo (tuổi 2 và 1).
  const mapBenh = mapTay([sk('lam_phat'), sk('tang_lai_suat'), gd('tang')]);

  it('⭐⭐ cờ bật: dư âm lạm phát VẮNG, dư âm thuốc còn; cờ tắt: cả hai còn', () => {
    const co = echoDangCo(mapBenh, 3, true).map((e) => e.su_kien);
    expect(co).not.toContain('lam_phat');
    expect(co).toContain('tang_lai_suat');
    const khong = echoDangCo(mapBenh, 3).map((e) => e.su_kien);
    expect(khong).toContain('lam_phat');
    expect(khong).toContain('tang_lai_suat');
  });

  it('⭐ thuốc GIẢ không dập được gì', () => {
    const mapGia = mapTay([sk('lam_phat'), sk('tang_lai_suat', true), gd('tang')]);
    expect(echoDangCo(mapGia, 3, true).map((e) => e.su_kien)).toContain('lam_phat');
  });

  it('⭐ thuốc nổ TRƯỚC bệnh thì không dập — nhân quả có chiều', () => {
    const mapNguoc = mapTay([sk('tang_lai_suat'), sk('lam_phat'), gd('tang')]);
    expect(echoDangCo(mapNguoc, 3, true).map((e) => e.su_kien)).toContain('lam_phat');
  });

  it('bệnh GIẢ giữ nguyên luật cũ (đảo dấu) — không đi qua nhánh dập', () => {
    const mapBenhGia = mapTay([sk('lam_phat', true), sk('tang_lai_suat'), gd('tang')]);
    const e = echoDangCo(mapBenhGia, 3, true).find((x) => x.su_kien === 'lam_phat');
    expect(e?.dao).toBe(true);
  });
});

describe('III. CỘNG HƯỞNG TRÚ ẨN — vàng khuếch đại, không rò cờ', () => {
  const dm = { tai_san: ['vang', 'usd'], chien_thuat: [] };
  const nguonCT = [{ su_kien: 'chien_tranh', do_lon_bp: 10000, dao: false }];

  it('⭐⭐ vàng của nguồn trong cặp nhân đúng hệ số; mã khác không đụng', () => {
    const co = machEcho(nguonCT, ['vang', 'usd'], dm, undefined, undefined, true);
    const khong = machEcho(nguonCT, ['vang', 'usd'], dm);
    const vangCo = co.find((x) => x.id === 'vang')!;
    const vangKhong = khong.find((x) => x.id === 'vang')!;
    expect(vangCo.delta_bp).toBe(
      Math.trunc((vangKhong.delta_bp * TUONG_TAC_THE.CONG_HUONG_VANG_BP) / 10000));
    expect(vangCo.cong_huong_tru_an).toBe(true);
    expect(co.find((x) => x.id === 'usd')!.delta_bp)
      .toBe(khong.find((x) => x.id === 'usd')!.delta_bp);
  });

  it('⭐ tin bịa giả dạng cộng hưởng: cú ĐẢO cũng bị nhân — nói dối trả giá gấp rưỡi', () => {
    const nguonGia = [{ su_kien: 'cam_van', do_lon_bp: 10000, dao: true }];
    const vang = machEcho(nguonGia, ['vang'], dm, undefined, undefined, true)
      .find((x) => x.id === 'vang')!;
    const goc = MT_TAI_SAN_SU_KIEN['vang']!['cam_van']!;
    expect(vang.delta_bp)
      .toBe(Math.trunc((-goc * TUONG_TAC_THE.CONG_HUONG_VANG_BP) / 10000));
  });

  it('nguồn NGOÀI cặp không được nhân dù cờ bật', () => {
    const nguonTND = [{ su_kien: 'thien_nga_den', do_lon_bp: 10000, dao: false }];
    const co = machEcho(nguonTND, ['vang'], dm, undefined, undefined, true);
    const khong = machEcho(nguonTND, ['vang'], dm);
    expect(co[0]!.delta_bp).toBe(khong[0]!.delta_bp);
    expect(co[0]!.cong_huong_tru_an).toBeUndefined();
  });

  it('⭐⭐ helper dò cặp: dư âm đòi THẬT, ô đang lật đọc MẶT CHỮ (không rò la_tin_gia)', () => {
    // chien_tranh THẬT vòng 1, ô đang lật vòng 3 là cam_van GIẢ ⇒ VẪN true —
    // khuếch đại theo mặt chữ, người đọc vàng không dò được cờ (bẫy nhieuCua).
    const st = (o: unknown[], bat = true) =>
      ({ map: mapTay(o), tuong_tac_the: bat }) as never;
    expect(coCongHuongTruAn(st([sk('chien_tranh'), gd('tang'), sk('cam_van', true)]), 3))
      .toBe(true);
    // dư âm chien_tranh GIẢ (cờ đã công khai) ⇒ không mở cặp.
    expect(coCongHuongTruAn(st([sk('chien_tranh', true), gd('tang'), sk('cam_van')]), 3))
      .toBe(false);
    // trong cửa sổ VÒNG (5) dù dư âm chiến tranh đã chết ⇒ vẫn mở — chỉ dòng
    // còn sống được nhân, nhưng cặp không câm (bài học khe i+4, D158).
    expect(coCongHuongTruAn(
      st([sk('chien_tranh'), gd('tang'), gd('tang'), gd('tang'), sk('cam_van')]), 5))
      .toBe(true);
    // cách nhau QUÁ cửa sổ vòng ⇒ tắt.
    expect(coCongHuongTruAn(
      st([sk('chien_tranh'), gd('tang'), gd('tang'), gd('tang'), gd('tang'),
        gd('tang'), sk('cam_van')]), 7))
      .toBe(false);
    // cổng tắt ⇒ câm tuyệt đối.
    expect(coCongHuongTruAn(st([sk('chien_tranh'), gd('tang'), sk('cam_van')], false), 3))
      .toBe(false);
  });
});

describe('IV. Dây nối — không mắt nào rơi im lặng', () => {
  const doc = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');

  it('⭐ ĐỔ DẦU đủ 7 mắt bbDoDau (khai · reset mở · tiếp dầu ×2 cửa · nghiêng · vỡ sâu · reset vỡ)', () => {
    const src = doc('server/holdem/map.ts');
    expect((src.match(/bbDoDau/g) ?? []).length,
      'rơi một mắt là đổ-dầu chỉ còn một nửa cơ chế, im lặng').toBe(7);
  });

  /*
   * ⚠ Quét theo DÒNG, loại dòng định nghĩa. Bản đầu của chính bài này hỏng
   * hai kiểu: đếm cả `export function ...(` thành lời gọi, và regex lazy
   * `[^;]*?\)` dừng ở dấu `)` ĐẦU TIÊN của closure `(id)` nên chưa với tới
   * tham số cuối đã kết luận thiếu — thước sai thì đỏ sai (D83).
   */
  const dongGoi = (f: string, ten: string) => doc(f).split('\n')
    .filter((d) => d.includes(`${ten}(`) && !d.includes(`function ${ten}`));

  it('⭐ mọi đường server đọc echo qua echoCua — echoDangCo trần chỉ còn trong wrapper', () => {
    expect(dongGoi('server/holdem/engine.ts', 'echoDangCo').length,
      'engine: đúng 1 lời gọi trần (trong echoCua)').toBe(1);
    for (const f of ['server/holdem/bang_dien_tu.ts', 'server/holdem/nhip_lenh_bot.ts',
      'server/holdem_api.ts']) {
      expect(dongGoi(f, 'echoDangCo').length,
        `${f} gọi echoDangCo trần — tự tách khỏi luật ĐÚNG THUỐC`).toBe(0);
    }
  });

  it('⭐ mọi lời machEcho trong server mang cờ cộng hưởng — thiếu một là bảng lệch engine', () => {
    // engine 2 → 3 (D342): bước 2b đọc giá chợ của mã đang KHỐNG qua đúng machEcho, cấp 1.
    for (const [f, soLoi] of [['server/holdem/engine.ts', 3],
      ['server/holdem/bang_dien_tu.ts', 1]] as const) {
      const loi = dongGoi(f, 'machEcho');
      expect(loi.length, `${f}: số lời machEcho đổi — cập nhật bài này CÓ Ý THỨC`).toBe(soLoi);
      for (const l of loi) {
        expect(l, `${f}: một lời machEcho không mang chTruAn`).toContain('chTruAn');
      }
    }
  });
});
