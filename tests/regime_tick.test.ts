/**
 * MÁY REGIME TICK v36 R1 (D165) — nền tick trước, ô công bố sau; `phuc_hoi`
 * rời bộ rút, chỉ còn là nhãn CÓ NGUYÊN NHÂN (tin tốt thật cắt chuỗi giảm —
 * đúng chữ founder D152). Kế hoạch: `v36-dap-the-pha-ke-hoach.md` (bản 2).
 *
 *   §I   CỔNG — v36 = v35 + đúng MỘT cờ; tắt cờ ⇒ map byte-hệt v35.
 *   §II  ⭐⭐ PHUC_HOI CÓ NGUYÊN NHÂN TUYỆT ĐỐI — và đối chứng v35 cho thấy
 *        đúng cái bệnh bị giết (95% phuc_hoi v35 vô nguyên nhân).
 *   §III REGIME SỐNG QUA MẶT NGHỈ — điều máy cũ không làm được về cấu trúc.
 *   §IV  ĐÁY CẦN THỜI GIAN LÀ CẤU TRÚC — XUỐNG không nhảy thẳng LÊN qua
 *        hazard (đo với bongBongChuoi tắt để cô lập máy tick khỏi v27).
 *   §V   DÂY — 5 domain RNG mới + trần hazard (nghiêng, không định đoạt §3).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_DECISIONS, NHA_CAI, hoSoMap, laSeedManTap,
  luatCua, nhipChonBai, seedManTap, soGheTuSeed,
} from '../config/holdem.js';
import { bocThamVai } from '../server/holdem/vai.js';
import {
  chuoiDangChay, taoTran, tuyChonSinhMap, type GheMoi,
} from '../server/holdem/engine.js';
import { sinhMap } from '../server/holdem/map.js';
import { xepHangUngVien } from '../server/holdem/bang_dien_tu.js';

const ghe = (n: number): GheMoi[] => Array.from({ length: n }, (_, i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));
const kyMap = (seed: number, luat: Parameters<typeof taoTran>[2]) =>
  JSON.stringify(taoTran(seed, ghe(4), luat, 12).map);

describe('I. Cổng — v36 = v35 + đúng MỘT cờ', () => {
  it('⭐⭐ regimeTick = false ở TỪNG entry trừ v36', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      /*
       * ⚠ THƯỚC ĐÚNG LÀ "KHÔNG BẬT HỒI TỐ", KHÔNG PHẢI "CHỈ MỘT PHIÊN BẢN".
       * Bản đầu chốt `=== 'balance-v36-regime'`, nên MỖI LẦN thêm một phiên bản
       * kế thừa (v37…) là bài này đỏ dù không có gì hỏng — và một bài đỏ vì lý
       * do sai thì sẽ bị nới bừa cho qua (D79). Điều thật sự phải giữ: phiên bản
       * CŨ HƠN mốc không bao giờ được bật, vì đó mới là cú đổi replay trận đã lưu.
       */
      const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
      const moc = soCua('balance-v36-regime');
      if (soCua(ten) < moc) {
        expect(luat.regimeTick, `phiên bản CŨ "${ten}" bật cờ ⇒ đổi map trận đã lưu`)
          .not.toBe(true);
      } else {
        expect(luat.regimeTick, `phiên bản "${ten}" từ mốc trở đi phải bật`).toBe(true);
      }
    }
    expect(luatCua('phien-ban-khong-ton-tai').regimeTick).toBe(false);
  });

  it('⭐⭐ v36 tắt cờ ⇒ map GIỐNG TỪNG BYTE v35 — domain RNG mới không xê dịch cú rút cũ', () => {
    const v35 = luatCua('balance-v35-chuoi');
    const v36Tat = { ...luatCua('balance-v36-regime'), regimeTick: false };
    for (const seed of [1, 7, 42, 99, 1234]) {
      expect(kyMap(seed, v36Tat)).toBe(kyMap(seed, v35));
    }
  });

  it('cơ chế SỐNG: v36 vs v35 phải khác được', () => {
    let khac = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      if (kyMap(seed, luatCua('balance-v36-regime')) !== kyMap(seed, luatCua('balance-v35-chuoi'))) {
        khac += 1;
      }
    }
    expect(khac).toBeGreaterThan(0);
  });
});

describe('II. ⭐⭐ phuc_hoi có nguyên nhân tuyệt đối', () => {
  it('MỌI mặt phuc_hoi của v36 đứng ngay sau tin tốt THẬT — và phải tồn tại ít nhất một', () => {
    let tong = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const o = taoTran(seed, ghe(4), luatCua('balance-v36-regime'), 12).map.o;
      for (let i = 0; i < o.length; i += 1) {
        const x = o[i]!;
        if (x.kind !== 'giai_doan' || x.giai_doan !== 'phuc_hoi') continue;
        tong += 1;
        const tr = o[i - 1];
        expect(tr?.kind === 'su_kien' && !tr.la_tin_gia && tr.bao_truoc === 'tang',
          `seed ${seed} ô ${i}: phuc_hoi không có tin tốt thật đứng trước`).toBe(true);
      }
    }
    // Không có cái nào = bài rỗng (bẫy D93) — cơ chế cắt phải SỐNG.
    expect(tong, 'không một phuc_hoi nào trong 200 map — cú cắt chết').toBeGreaterThan(0);
  });

  it('đối chứng v35: phần lớn phuc_hoi VÔ nguyên nhân — đúng bệnh máy tick giết', () => {
    let tong = 0;
    let vo = 0;
    for (let seed = 1; seed <= 100; seed += 1) {
      const o = taoTran(seed, ghe(4), luatCua('balance-v35-chuoi'), 12).map.o;
      for (let i = 0; i < o.length; i += 1) {
        const x = o[i]!;
        if (x.kind !== 'giai_doan' || x.giai_doan !== 'phuc_hoi') continue;
        tong += 1;
        const tr = o[i - 1];
        if (!(tr?.kind === 'su_kien' && !tr.la_tin_gia && tr.bao_truoc === 'tang')) vo += 1;
      }
    }
    expect(tong).toBeGreaterThan(0);
    expect(vo, 'v35 mà hết phuc_hoi vô nguyên nhân thì đối chứng này hết nghĩa')
      .toBeGreaterThan(0);
  });
});

describe('III. Regime sống qua mặt nghỉ — cấu trúc mới', () => {
  it('⭐ tồn tại ô mặt di_ngang mang run_huong ≠ 0 ở v36; v35 thì KHÔNG BAO GIỜ', () => {
    const demSongQuaNghi = (phienBan: string): number => {
      let dem = 0;
      for (let seed = 1; seed <= 60; seed += 1) {
        const map = taoTran(seed, ghe(4), luatCua(phienBan), 12).map;
        map.o.forEach((x, i) => {
          if (x.kind === 'giai_doan' && x.giai_doan === 'di_ngang'
            && (map.trang_thai?.[i]?.run_huong ?? 0) !== 0) dem += 1;
        });
      }
      return dem;
    };
    expect(demSongQuaNghi('balance-v36-regime'),
      'nền không sống qua mặt nghỉ — tick chưa tách nền khỏi mặt').toBeGreaterThan(0);
    expect(demSongQuaNghi('balance-v35-chuoi'),
    // eslint-disable-next-line vitest/valid-expect
      'máy cũ mà cũng có thì bài này không phân biệt được gì').toBe(0);
  });
});

describe('IV. Đáy cần thời gian là CẤU TRÚC', () => {
  it('⭐ XUỐNG không nhảy thẳng LÊN qua hazard — chỉ phuc_hoi (cú cắt) được phép', () => {
    // bongBongChuoi TẮT để mọi ô pha đi qua máy tick (cô lập khỏi v27 —
    // trong chế độ bong bóng, đường cũ được giữ nguyên có chủ đích).
    const luat = { ...luatCua('balance-v36-regime'), bongBongChuoi: false };
    for (let seed = 1; seed <= 120; seed += 1) {
      const map = taoTran(seed, ghe(4), luat, 12).map;
      let hTruoc = 0;
      map.o.forEach((x, i) => {
        if (x.kind !== 'giai_doan') return;
        const h = map.trang_thai?.[i]?.run_huong ?? 0;
        /*
         * ⚠ Ô prior=10000 là ô bị HÀNG ĐỢI định đoạt (tắt bongBongChuoi thì
         * bong bóng rơi về máy chuoiEp CŨ ép 'tang,tang' — không phải cú
         * tick). Lọc bằng chính dấu vết đó — bài đầu không lọc và đỏ vì đo
         * nhầm máy (thước sai, không phải dây sai — D83).
         */
        if (map.trang_thai?.[i]?.face_prior_bp === 10000) { hTruoc = h; return; }
        /*
         * Bất biến MẠNH (siết sau khi mũi tiêm XUỐNG-đảo-thẳng LỌT bài bản
         * đầu: cú tiêm phát mặt tang nhưng nền về NGANG nên canh-run mù):
         * sau nền XUỐNG, mặt TĂNG bị cấm tuyệt đối — chỉ phuc_hoi (cú cắt
         * có tin tốt thật) được mang tin lên.
         */
        if (hTruoc === -1) {
          expect(x.giai_doan === 'tang',
            `seed ${seed} ô ${i}: mặt TĂNG mọc thẳng từ nền XUỐNG`).toBe(false);
        }
        hTruoc = h;
      });
    }
  });
});

describe('V. Dây — domain mới + trần hazard', () => {
  it('5 domain RNG _tick_* và trần Math.min(9000, hz) có mặt', () => {
    const src = readFileSync(resolve(process.cwd(), 'server/holdem/map.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');
    for (const d of ['_tick_cat', '_tick_haz', '_tick_mat', '_tick_chuyen', '_tick_mo']) {
      expect(src, `thiếu domain ${d}`).toContain(d);
    }
    expect(src, 'mất trần hazard — 100% gãy là ĐỊNH ĐOẠT, phạm §3 addendum')
      .toContain('Math.min(9000, hz)');
  });
});

describe('VI. R4 (D167) — dự báo xếp hạng bằng MÁY ĐANG SINH Ô', () => {
  it('⭐⭐ trận tick: `phuc_hoi` KHÔNG BAO GIỜ là ứng viên (nó chỉ sinh từ cú cắt)', () => {
    /*
     * Bảng cũ cho phuc_hoi trọng số 1500 như mọi mặt — trên máy tick nó là
     * tên KHÔNG THỂ ĐÚNG trừ khi cú cắt nổ, tức bán một cái tên chết. Bài này
     * khoá đúng chỗ đó; ca ngược (v35) vẫn phải thấy phuc_hoi để bài có nghĩa.
     */
    const st = taoTran(5, ghe(2), luatCua('balance-v36-regime'), 12);
    let coTick = 0;
    let coCu = 0;
    for (let v = 1; v < st.map.o.length; v += 1) {
      const hang = xepHangUngVien({ ...st, vong: v });
      if ((hang.find((x) => x.key === 'gd:phuc_hoi')?.w ?? 0) > 0) coTick += 1;
      const hangCu = xepHangUngVien({ ...st, vong: v, regime_tick: false });
      if ((hangCu.find((x) => x.key === 'gd:phuc_hoi')?.w ?? 0) > 0) coCu += 1;
    }
    expect(coTick, 'phuc_hoi vẫn được xếp hạng trên máy tick — bán tên chết').toBe(0);
    expect(coCu, 'bảng cũ mà cũng bỏ phuc_hoi thì bài này không phân biệt gì')
      .toBeGreaterThan(0);
  });

  it('⭐ nền SỐNG hướng lên: mặt THUẬN nặng hơn mặt NGƯỢC — dự báo nghe nền', () => {
    /*
     * ⚠ KHÔNG canh "thuận là nặng NHẤT": `di_ngang` gộp CẢ cửa nghỉ LẪN cửa
     * gãy-về-ngang nên nó nặng hơn mặt thuận — và đó là mô hình ĐÚNG (bài bản
     * đầu canh sai chỗ này rồi đỏ; code không sai). Thứ phải đúng là dự báo
     * nghe nền: thuận > ngược, và ngược chỉ tồn tại qua cửa gãy.
     */
    const st = taoTran(5, ghe(2), luatCua('balance-v36-regime'), 12);
    let daKiem = 0;
    for (let v = 1; v < st.map.o.length; v += 1) {
      if (st.map.o[v - 1]?.kind === 'su_kien') continue;   // telegraph nâng mặt khác
      const run = chuoiDangChay(st.map.o, v + 1);
      if (run.huong !== 1) continue;
      const hang = xepHangUngVien({ ...st, vong: v });
      const w = (id: string) => hang.find((x) => x.key === `gd:${id}`)?.w ?? 0;
      expect(w('tang'), `vòng ${v}: nền LÊN mà mặt tang không nặng hơn giam`)
        .toBeGreaterThan(w('giam'));
      daKiem += 1;
    }
    expect(daKiem, 'không ca nào được kiểm — bài rỗng (bẫy D93)').toBeGreaterThan(0);
  });
});

describe('VII. R4b (D168) + D300 — màn tập + xu hướng khớp máy đang chạy', () => {
  it('⭐⭐ seed tập 12 ô (D300) kể ĐÚNG kịch bản CoachTap: từng ô, vai, kỳ ngộ', () => {
    /*
     * D168 chọn seed v36 bằng bộ lọc "ô 2 là tin GIẢ" mà KHÔNG khoá tên tin ⇒
     * CoachTap kể "BONG BÓNG… tiền đang đắt" trong khi bàn lật THẢM HOẠ với lãi
     * suất trung tính — xanh mà sai suốt từ 30/08 (soi 07/09). Bài này khoá TỪNG
     * Ô của bàn mới, và khoá cả VAI + KỲ NGỘ: hai thứ bàn 8 ô về cấu trúc không
     * dạy được (vai chỉ bốc ở ≥ 12 ô, kỳ ngộ chỉ có ở 12/16) — lý do D300 chuyển
     * màn tập sang 12 ô. Lời CoachTap ↔ ô thật khoá ở `web/tests/coach_ban_tap`.
     * Đổi seed, chỉnh REGIME_TICK/HO_SO_MAP, hay lật phiên bản đổi luật sinh map
     * là bài này đỏ — đúng như phải thế: quét seed lại là bước CUỐI của lượt chỉnh.
     */
    const day = (seed: number, soO: number) =>
      taoTran(seed, ghe(2), luatCua('balance-v36-regime'), soO)
        .map.o.map((x) => (x.kind === 'su_kien'
          ? `[${x.su_kien}${x.la_tin_gia ? '-G' : ''}]` : x.giai_doan));
    const seed = HOLDEM_DECISIONS.MAN_TAP_SEED_12;
    const soO = HOLDEM_DECISIONS.MAN_TAP_SO_O;
    expect(soO, 'bàn tập phải ≥ 12 ô để có vai + kỳ ngộ').toBeGreaterThanOrEqual(12);
    expect(day(seed, soO)).toEqual([
      'di_ngang', '[hack_san-G]', 'giam', '[ha_lai_suat]', 'phuc_hoi', 'bien_dong',
      '[bong_bong]', 'tang', '[tang_lai_suat]', 'giam', 'giam', 'giam',
    ]);
    // Kỳ ngộ đúng vòng 7 của nhịp bàn 12 (v36: kyNgo + gianLa).
    expect(nhipChonBai(soO, true, true)[6]).toBe('ky_ngo');
    // Vai: người chơi (ghế 0) là CÁ NHÂN; bàn có đủ ba vai đặc biệt để chỉ vào.
    const vai = bocThamVai(seed, soGheTuSeed(seed));
    expect(vai[0]).toBe('ca_nhan');
    expect(new Set(vai)).toEqual(new Set(['ca_nhan', 'ca_map', 'to_chuc', 'doi_lai']));
    // Vế đối chứng (D168): bàn 8 ô cũ dưới v36 không còn cú gãy ở ô 8.
    expect(day(HOLDEM_DECISIONS.MAN_TAP_SEED, 8)[7],
      'bàn cũ vẫn kể đúng dưới v36 ⇒ lý do đổi seed ở D168 hết tồn tại').not.toBe('giam');
  });
  it('⭐⭐ D303 — seed tập cho luật CHU KỲ THỰC TẾ (mặc định v40) kể CÙNG kịch bản, từng ô, vai, kỳ ngộ', () => {
    // v39 đổi bộ số máy tick nên MAN_TAP_SEED_12 sinh dãy khác dưới v40; seed mới quét
    // CHẶT để CoachTap giữ nguyên lời. Bài này đỏ là bàn tập đang kể một bàn không tồn tại.
    const seed = HOLDEM_DECISIONS.MAN_TAP_SEED_THUC_TE;
    const soO = HOLDEM_DECISIONS.MAN_TAP_SO_O;
    const day = taoTran(seed, ghe(2), luatCua('balance-v40-lichcodinh'), soO)
      .map.o.map((x) => (x.kind === 'su_kien'
        ? `[${x.su_kien}${x.la_tin_gia ? '-G' : ''}]` : x.giai_doan));
    // 11/12 ô y hệt D300; ô 6 là TĂNG thay biến động — dưới bộ số v39 pha tăng dài hơn,
    // phục hồi chảy thẳng vào tăng rồi bong bóng (quét 1.000.000 seed: 0 bàn có biến động
    // ở ô 6, 2 bàn đạt mọi ô CoachTap kể). Không bước CoachTap nào kể ô 6.
    expect(day).toEqual([
      'di_ngang', '[hack_san-G]', 'giam', '[ha_lai_suat]', 'phuc_hoi', 'tang',
      '[bong_bong]', 'tang', '[tang_lai_suat]', 'giam', 'giam', 'giam',
    ]);
    const vai = bocThamVai(seed, soGheTuSeed(seed));
    expect(vai[0]).toBe('ca_nhan');
    expect(new Set(vai)).toEqual(new Set(['ca_nhan', 'ca_map', 'to_chuc', 'doi_lai']));
    // Một cửa chọn seed: cờ chuKyThucTe ⇒ seed này (v39 và v40), v36–v38 ⇒ seed D300.
    expect(seedManTap('balance-v40-lichcodinh')).toBe(seed);
    expect(seedManTap('balance-v39-thucte')).toBe(seed);
    expect(seedManTap('balance-v38-doixung')).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_12);
    expect(laSeedManTap(seed)).toBe(true);
  });

  it('⭐ nhận ra bàn tập ở MỌI seed từng dùng — trận tập đã lưu không mất miễn giờ', () => {
    expect(laSeedManTap(HOLDEM_DECISIONS.MAN_TAP_SEED)).toBe(true);
    expect(laSeedManTap(HOLDEM_DECISIONS.MAN_TAP_SEED_V36)).toBe(true);
    expect(laSeedManTap(HOLDEM_DECISIONS.MAN_TAP_SEED_12)).toBe(true);
    expect(laSeedManTap(12345)).toBe(false);
    // Một cửa chọn seed: v36 trở lên ra bàn 12 ô (D300), v35 giữ seed cũ.
    expect(seedManTap('balance-v36-regime')).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_12);
    expect(seedManTap('balance-v35-chuoi')).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED);
  });
});
describe('VIII. R5 (D169) — MỘT CỬA luật→tuỳ chọn sinh map', () => {
  it('⭐⭐ không tầng server nào tự dựng object tuỳ chọn cho sinhMap', () => {
    /*
     * Bản chép tay ở `hanh_vi/kho.ts` ĐÃ TRÔI: nó dừng ở v32, thiếu cả bốn cờ
     * v35/v36 ⇒ map dựng lại để trải kho hành vi là map của MỘT TRÒ KHÁC, nên
     * `o_su_kien`/`la_tin_gia`/`chuoi_tang` của mọi trận v35 bị dán nhãn sai —
     * hỏng im lặng ở đúng tầng ĐO. Bài này cấm bản sao thứ hai mọc lại.
     */
    /*
     * ⚠ `tests/helpers/ho_so_cu.ts` cũng nằm trong danh sách: nó là ORACLE của
     * bài "kho hành vi ≡ hàm cũ", và nó ĐÃ trôi y hệt (dừng ở v32) — bản trôi
     * làm bài đó đỏ với hai object trông giống hệt nhau (D172). Bản sao thứ ba
     * xuất hiện ở đúng chỗ ít ai ngờ nhất: file test.
     */
    for (const f of ['server/holdem/engine.ts', 'server/hanh_vi/kho.ts',
      'tests/helpers/ho_so_cu.ts']) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const goi = src.split('\n').filter((d) => d.includes('sinhMap('));
      for (const d of goi) {
        expect(d, `${f}: sinhMap phải nhận tuyChonSinhMap(luat), không object tay`)
          .toMatch(/tuyChonSinhMap\(|export function sinhMap/);
      }
    }
  });

  it('⭐ helper chở ĐỦ cờ map — thiếu một cờ là map dựng lại khác map đã chạy', () => {
    const luat = luatCua('balance-v36-regime');
    const t = tuyChonSinhMap(luat) as Record<string, boolean>;
    for (const k of ['lich', 'quanTinh', 'sucCang', 'chuKy', 'duoiTelegraph', 'duoi5',
      'laiSuatNen', 'bongBongChuoi', 'mapV28', 'banSac', 'chuoiMoRong', 'tuongTac',
      'markovNguon', 'regimeTick']) {
      expect(t[k], `thiếu cờ ${k}`).toBe(true);
    }
    // Và map dựng qua helper phải GIỐNG HỆT map của taoTran cùng luật.
    expect(JSON.stringify(sinhMap(77, 12, tuyChonSinhMap(luat))))
      .toBe(JSON.stringify(taoTran(77, ghe(2), luat, 12).map));
  });
});

describe('IX. D177 — HỒ SƠ MAP 8: bàn NGẮN & CĂNG', () => {
  const H: Record<string, number> = {
    tang: 1, phuc_hoi: 1, giam: -1, di_ngang: 0, bien_dong: 0,
  };
  /** Đếm "ô phải quyết" (tin + ô đổi chiều) và ô đi-ngang trên N map. */
  const dem = (size: number, luat: Parameters<typeof taoTran>[2], N = 400) => {
    let tin = 0; let ngang = 0; let quyet = 0; let o = 0;
    for (let seed = 1; seed <= N; seed += 1) {
      let h = 0;
      for (const x of taoTran(seed, ghe(4), luat, size).map.o) {
        o += 1;
        if (x.kind === 'su_kien') { tin += 1; quyet += 1; continue; }
        if (x.giai_doan === 'di_ngang') ngang += 1;
        const hh = H[x.giai_doan] ?? 0;
        if (hh !== 0 && h !== 0 && hh !== h) quyet += 1;
        if (hh !== 0) h = hh;
      }
    }
    return { tin: tin / N, ngang: ngang / N, quyet: quyet / o };
  };

  it('⭐⭐ map 8 CĂNG hơn map 12: mật độ ô-phải-quyết cao hơn, ít ô nghỉ hơn', () => {
    const v36 = luatCua('balance-v36-regime');
    const m8 = dem(8, v36);
    const m12 = dem(12, v36);
    expect(m8.quyet, 'map 8 phải DÀY quyết định hơn map 12 — đó là cả lý do hồ sơ này tồn tại')
      .toBeGreaterThan(m12.quyet);
    // Ô nghỉ TÍNH THEO TỶ LỆ (map 12 dài hơn nên số tuyệt đối luôn lớn hơn).
    expect(m8.ngang / 8).toBeLessThan(m12.ngang / 12);
  });

  it('⭐ map 8 v36 nhiều TIN hơn hẳn map 8 v35 — chơi đúng sở trường của nó', () => {
    expect(dem(8, luatCua('balance-v36-regime')).tin)
      .toBeGreaterThan(dem(8, luatCua('balance-v35-chuoi')).tin * 1.2);
  });

  it('⭐⭐ hồ sơ KHOANH ĐÚNG CỠ 8 — map 12/16 không xê dịch một byte nào', () => {
    /*
     * Bài chịu lực của cách cắm: hồ sơ đi qua `hoSoMap(size, …)` nên cỡ không
     * khai phải trả hệ số trung tính. Nếu ai đó "dọn" bằng cách áp thẳng hằng
     * số, map 12/16 đổi im lặng và mọi bảng gate của chúng thành vô nghĩa.
     */
    const v36 = luatCua('balance-v36-regime');
    for (const size of [12, 16]) {
      const truoc = hoSoMap(size, true);
      expect(truoc.nghiXBp, `cỡ ${size} phải trung tính`).toBe(10000);
      expect(truoc.hazardXBp).toBe(10000);
      expect(truoc.tyLeSuKienBp).toBe(NHA_CAI.TY_LE_O_SU_KIEN_BP);
    }
    // Và cờ tick TẮT ⇒ map 8 cũng trung tính (v35 replay nguyên).
    expect(hoSoMap(8, false).tyLeSuKienBp).toBe(NHA_CAI.TY_LE_O_SU_KIEN_BP);
    expect(hoSoMap(8, true).tyLeSuKienBp).toBeGreaterThan(NHA_CAI.TY_LE_O_SU_KIEN_BP);
    // Map 8 của v35 KHÔNG đổi vì hồ sơ (cổng tick).
    const a = JSON.stringify(taoTran(3, ghe(4), luatCua('balance-v35-chuoi'), 8).map);
    const b = JSON.stringify(taoTran(3, ghe(4),
      { ...luatCua('balance-v35-chuoi') }, 8).map);
    expect(a).toBe(b);
    void v36;
  });
});
