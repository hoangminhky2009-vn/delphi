/**
 * D433 — LỜI BÁO CỦA TIN: NGƯỜI THẤY ĐÚNG LÁ BOT ĐỌC (luật ô úp).
 *
 * Luật ô úp (D373 → D382): ở vòng N, lá `o[0..N-1]` đã ngửa và cú chốt lật `o[N]`. Bot chấm lá úp bằng lời báo
 * của lá VỪA LẬT (`boiCanhUpCua` → `o[vongDaLat−1]`). Màn người chơi (`holdem_api` · `telegraph`) từ D382 vẫn
 * đọc `o[vong−2]` như luật ngửa ⇒ gạch nghiêng tới trễ một vòng, rơi sai ô úp — tức bot biết lời báo sớm hơn
 * người (lớp "úp với người mà không úp với bot", đúng thứ `oUp` sinh ra để chặn). Bàn tập v54 (D433) dạy đúng
 * cái gạch ấy (`tin-truoc`), nên lỗi lộ ra ở đây.
 *
 * Bài hai chiều: (I) v54 — lá `iLaBaoTruoc` = lá bot đọc ở MỌI vòng của bàn tập; (II) luật ngửa giữ nguyên
 * `vong−2`; (III) tiêm ngược thường trực — công thức cũ dưới v54 phải LỆCH ít nhất một vòng có tin, nếu không
 * bài (I) là bài rỗng.
 */
import { describe, expect, it } from 'vitest';
import {
  boiCanhUpCua, iLaBaoTruoc, soVong, taoTran, tuyChonSinhMap, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { sinhMap } from '../server/holdem/map.js';
import { HOLDEM_DECISIONS, luatCua, seedManTap } from '../config/holdem.js';

const GHE: readonly GheMoi[] = [
  { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
  { id: 'b1', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
];

/** Bàn tập thật của một khoá luật, đặt ở vòng `v` (bàn dựng bằng đúng engine server dùng). */
function banTap(khoa: string, v: number): TrangThaiTran {
  const luat = luatCua(khoa);
  const seed = seedManTap(khoa);
  const st = taoTran(seed, GHE, luat);
  const map = sinhMap(seed, HOLDEM_DECISIONS.MAN_TAP_SO_O, tuyChonSinhMap(luat));
  return { ...st, map: { ...st.map, ...map }, vong: v };
}

/** Lời báo người chơi thấy qua một công thức chỉ số (null = ô ấy không phải tin). */
const baoQua = (st: TrangThaiTran, i: number): string | null => {
  const o = st.map.o[i];
  return o?.kind === 'su_kien' ? o.bao_truoc : null;
};

const V54 = 'balance-v54-ngare';
const soVongV54 = soVong(banTap(V54, 1));

describe('I. v54 (ô úp) — lá người thấy = lá bot đọc, ở mọi vòng', () => {
  it('⭐ bàn đo có vòng mang lời báo (rỗng ⇒ bài không canh gì)', () => {
    let co = 0;
    for (let v = 1; v <= soVongV54; v += 1) if (boiCanhUpCua(banTap(V54, v))?.up.bao_truoc) co += 1;
    expect(co).toBeGreaterThanOrEqual(2);
  });

  it('⭐⭐ vòng nào cũng vậy: `iLaBaoTruoc` trỏ đúng lá `boiCanhUpCua` đọc', () => {
    for (let v = 1; v <= soVongV54; v += 1) {
      const st = banTap(V54, v);
      expect(baoQua(st, iLaBaoTruoc(st)), `vòng ${v}`).toBe(boiCanhUpCua(st)?.up.bao_truoc ?? null);
    }
  });
});

describe('II. Luật ngửa (v52) giữ nguyên công thức cũ', () => {
  it('ô của vòng ngửa ⇒ lá báo trước là ô ngay trước nó (`vong − 2`)', () => {
    for (const v of [2, 5, 9]) expect(iLaBaoTruoc(banTap('balance-v52-dadang', v))).toBe(v - 2);
  });
});

describe('III. Tiêm ngược thường trực — công thức trước D433 phải bị bắt', () => {
  it('⭐⭐ `vong − 2` dưới v54 lệch lá bot đọc ở ít nhất một vòng', () => {
    const lech: number[] = [];
    for (let v = 1; v <= soVongV54; v += 1) {
      const st = banTap(V54, v);
      if (baoQua(st, v - 2) !== (boiCanhUpCua(st)?.up.bao_truoc ?? null)) lech.push(v);
    }
    expect(lech.length).toBeGreaterThan(0);
  });
});
