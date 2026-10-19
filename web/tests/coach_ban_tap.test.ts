/**
 * KHOÁ THOẠI ↔ BÀN TẬP 12 Ô (07/09) — vì sao file này tồn tại.
 *
 * D168 chọn seed màn tập bằng bộ lọc SỐ ("ô 2 phải là tin giả") nhưng không rà
 * lại CÂU CHỮ của CoachTap khớp ô thật — nên Oracle kể sai TÊN tin (nói "bong
 * bóng" trong khi ô thật là "hack sàn") suốt từ 30/08 mà không bài test nào
 * bắt được: tsc xanh, lint xanh, cả bộ test cũ cũng xanh, chỉ có lời trên màn
 * là sai. Đây là lớp lỗi CHỈ MẮT NGƯỜI thấy nếu không có bài khoá kiểu này.
 *
 * Ba khoá, kiểm đủ ba hướng đổi mà không ai nhận ra:
 *  1. Mỗi bước có `keO` (khai "bước này kể ô nào") phải khớp ĐÚNG ô thật của
 *     bàn tập — dựng bằng CHÍNH engine server dùng lúc chơi thật (`sinhMap` +
 *     `tuyChonSinhMap`), không phải một bảng chép tay có thể tự trôi khỏi
 *     luật (A11.5 — bản cài đặt thứ hai SẼ trôi).
 *  2. Lời của bước đó phải chứa đúng TỪ KHOÁ ứng với loại ô — đổi lời mà quên
 *     đổi ô (hoặc ngược lại) đỏ ngay, không cần founder tự chơi mới phát hiện.
 *  3. Mọi neo `data-tap` mà coach rọi vào phải THẬT SỰ tồn tại trong `web/src`
 *     — bắt được lớp lỗi "rọi vào một neo đã gỡ" (vd `pnl`, gỡ theo D184).
 * Cộng thêm (D433): bàn tập không có kỳ ngộ thì không bước mạch kể nào được chờ nó.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  GIAI_DOAN, HOLDEM_DECISIONS, QUAN_TINH, SU_KIEN, TAI_SAN, TIET_KIEM, boMaTranCua, laSeedManTapCoDinh, luatCua,
  mtGiaiDoan, mtSuKien, nhipChonBai, seedManTap,
} from '@config/holdem';
import { moiTruongCua } from '../src/lib/moi_truong';
import { tuyChonSinhMap } from '@server/holdem/engine';
import { sinhMap } from '@server/holdem/map';
import { bayShop } from '@server/holdem/shop';
import {
  KICH_BAN, VONG_DAY_NGAN_HANG, loiCuaBuoc, type BoiCanhTap,
} from '../src/components/holdem/CoachTap';

/** Bối cảnh mẫu — chỉ dùng để giải các bước có `loi` TĨNH (không hàm). Không
 *  bước nào mang `keO` mà `loi` là hàm (`dong-ho` là hàm nhưng không có
 *  `keO`), nên nội dung cụ thể của bối cảnh này không ảnh hưởng phép so. */
const boiCanhMau: BoiCanhTap = {
  vong: 1, shopMo: false, bangMo: false, shopChonMa: false, coKetQua: false,
  loaiVongNay: 'tai_san', xong: false, onMoShop: () => {},
};

// ─── I. DỰNG BÀN TẬP THẬT — cùng engine, cùng luật server dùng lúc chơi ─────

// D392 → gộp 0.0.46 — bàn tập chạy luật GHIM của nó (một nguồn `HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION`, cùng cửa server
// dùng lúc dựng bàn tập). Đọc thẳng khoá mặc định là dựng một bàn tập không tồn tại (đúng lỗi D302).
// D527 — bàn tập mặc định sang v58 (trợ lý `KICH_BAN_MINIGAME`, bài `coach_minigame`). `KICH_BAN` này còn chạy cho trận tập
// v54 dở ⇒ ghim khoá v54 ĐÍCH DANH (seed theo khoá — `seedManTap`).
const KHOA_TAP = 'balance-v54-ngare';
const luat = luatCua(KHOA_TAP);
const seed = seedManTap(KHOA_TAP);
const ban = sinhMap(seed, HOLDEM_DECISIONS.MAN_TAP_SO_O, tuyChonSinhMap(luat));

describe('I. Bàn tập seed 12 ô dựng đúng — nền cho mọi phép so bên dưới', () => {
  it('D445 — bàn tập v54 (bánh xe) chạy seed dạy màu bàn MAN_TAP_SEED_MAU_BAN, và seed ấy là bàn CỐ ĐỊNH (không bẻ ô)', () => {
    expect(luat.banhXe).toBe(true);
    expect(seed).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_MAU_BAN);
    expect(laSeedManTapCoDinh(seed)).toBe(true);
  });

  it('bàn có đúng MAN_TAP_SO_O ô (12)', () => {
    expect(HOLDEM_DECISIONS.MAN_TAP_SO_O).toBe(12);
    expect(ban.o.length).toBe(HOLDEM_DECISIONS.MAN_TAP_SO_O);
  });
});

// ─── II. KHOÁ THOẠI ↔ Ô THẬT ────────────────────────────────────────────────

/**
 * Từ khoá BẮT BUỘC trong lời, theo id ô (su_kien hoặc giai_doan).
 * ⚠ 15/09 (D336) — ô sự kiện đọc TỪ NHÃN CATALOG, không gõ tay. Bài này từng ghim
 * 'HACK SÀN' — nhãn đã đổi thành "Sập sàn" từ v28 (08/08), nên suốt năm tuần bài khoá
 * chữ lại chính là thứ giữ Oracle nói một tên khác với tên in trên thẻ.
 */
const nhanSuKien = (id: string): string =>
  (SU_KIEN.find((x) => x.id === id)?.label ?? id).toLocaleUpperCase('vi-VN');
const TU_KHOA: Readonly<Record<string, readonly string[]>> = {
  hack_san: [nhanSuKien('hack_san')],
  // D445 — lá mở màn và ô đình trệ.
  di_ngang: ['ĐI NGANG'],
  ha_lai_suat: ['HẠ LÃI'],
  tang_lai_suat: ['TĂNG LÃI'],
  bong_bong: ['BONG BÓNG'],
  phuc_hoi: ['PHỤC HỒI'],
  giam: ['GIẢM'],
};

const buocCoKeO = KICH_BAN.filter((b) => b.keO !== undefined);

describe('II. Mỗi bước `keO` khớp đúng ô thật của bàn, lời chứa đúng từ khoá', () => {
  it('⭐ có bước keO cho từng cột mốc của bàn (không rỗng, không thiếu loại)', () => {
    // Sáu loại mốc bối cảnh đã đo khai ở trên (bảng ô THẬT) — thiếu một cái là
    // một khúc của chuỗi đang kể chuyện KHÔNG có khoá nào canh.
    const idDaKhoa = new Set(buocCoKeO.map((b) => b.keO!.su_kien ?? b.keO!.giai_doan));
    // D445 — seed dạy màu bàn: lá mở màn ĐI NGANG thay cho tin giả ô 2 của seed 77004.
    for (const idBatBuoc of ['di_ngang', 'ha_lai_suat', 'phuc_hoi', 'bong_bong', 'tang_lai_suat', 'giam']) {
      expect(idDaKhoa.has(idBatBuoc), `không có bước nào khoá ô loại "${idBatBuoc}"`).toBe(true);
    }
  });

  for (const buoc of buocCoKeO) {
    const keO = buoc.keO!;

    it(`${buoc.id} (vòng ${keO.vong}) — ô thật khớp keO đã khai`, () => {
      const o = ban.o[keO.vong - 1];
      if (!o) throw new Error(`bàn tập không có ô ở vòng ${keO.vong} (bàn chỉ có ${ban.o.length} ô)`);

      if (keO.giai_doan !== undefined) {
        expect(
          o.kind === 'giai_doan' && o.giai_doan === keO.giai_doan,
          `bước ${buoc.id} khai giai_doan="${keO.giai_doan}" ở vòng ${keO.vong}, ô thật là ${JSON.stringify(o)}`,
        ).toBe(true);
      }
      if (keO.su_kien !== undefined) {
        expect(
          o.kind === 'su_kien' && o.su_kien === keO.su_kien,
          `bước ${buoc.id} khai su_kien="${keO.su_kien}" ở vòng ${keO.vong}, ô thật là ${JSON.stringify(o)}`,
        ).toBe(true);
        if (keO.la_tin_gia !== undefined) {
          expect(
            o.kind === 'su_kien' && o.la_tin_gia === keO.la_tin_gia,
            `bước ${buoc.id} khai la_tin_gia=${keO.la_tin_gia} ở vòng ${keO.vong}, ô thật là ${JSON.stringify(o)}`,
          ).toBe(true);
        }
      }
    });

    it(`${buoc.id} (vòng ${keO.vong}) — lời chứa đúng từ khoá của loại ô`, () => {
      const loi = loiCuaBuoc(buoc, boiCanhMau);
      const idBaiHoc = keO.su_kien ?? keO.giai_doan;
      if (keO.anTen === true) {
        /*
         * D336 lượt 2 — lời CỐ Ý không gọi tên ô (`chuyen-v2`: nguyên câu founder chốt 15/09). Khoá đổi
         * chiều: không đòi từ khoá, nhưng lời KHÔNG được gọi tên bất kỳ ô nào khác (đúng lớp lỗi bài
         * này sinh ra để bắt — "nói bong bóng trong khi ô là sập sàn"); ô tin giả thì lời phải giữ ý
         * CHƯA BIẾT (không được khẳng định tin thật).
         */
        const HOA = loi.toLocaleUpperCase('vi-VN');
        for (const sk of SU_KIEN) {
          expect(HOA.includes(sk.label.toLocaleUpperCase('vi-VN')), `bước ${buoc.id} gọi tên ô "${sk.label}"`).toBe(false);
        }
        for (const gd of GIAI_DOAN) {
          expect(HOA.includes(gd.label.toLocaleUpperCase('vi-VN')), `bước ${buoc.id} gọi tên pha "${gd.label}"`).toBe(false);
        }
        if (keO.la_tin_gia === true) {
          expect(/mới biết|GIẢ|TIN ĐỒN|chưa kiểm chứng/.test(loi), `bước ${buoc.id}: ô tin giả mà lời không giữ ý chưa biết`)
            .toBe(true);
        }
        return;
      }
      const chapNhan = idBaiHoc ? TU_KHOA[idBaiHoc] : undefined;
      if (chapNhan) {
        // Vòng 10 (vỡ) được phép nói "VỠ" thay cho "GIẢM" — cùng một sự thật,
        // hai cách gọi (xem bảng từ khoá trong prompt việc).
        const list = idBaiHoc === 'giam' && keO.vong === 10 ? [...chapNhan, 'VỠ'] : chapNhan;
        expect(
          list.some((t) => loi.includes(t)),
          `bước ${buoc.id}: lời "${loi}" thiếu một trong từ khoá [${list.join(', ')}]`,
        ).toBe(true);
      }
      if (keO.la_tin_gia === true) {
        expect(
          loi.includes('GIẢ') || loi.includes('TIN ĐỒN'),
          `bước ${buoc.id}: ô là TIN GIẢ nhưng lời "${loi}" không nói rõ (thiếu "GIẢ"/"TIN ĐỒN")`,
        ).toBe(true);
      }
    });
  }
});

// ─── II-bis. D445 — KHOÁ LỜI "MÀU BÀN" ↔ MÀU BÀN THẬT ──────────────────────────
/*
 * Founder 28/09: Oracle dạy đọc MÀU BÀN (nền dải thẻ, D442) + lá mở màn để đoán lá kế. Màu bàn ở vòng V = `xu_huong`
 * công khai của ô V (ô vừa lật) — dựng lại đúng như server (`holdem_api.ts`: `run_huong ≠ 0` và `run_dai ≥
 * QUAN_TINH.NGUONG_CHUOI`) rồi qua CHÍNH hàm màn trận dùng (`moiTruongCua`). Lời nói "bàn ĐỎ" mà bàn xám là đỏ bài.
 */
const mauBanVong = (v: number) => {
  const t = ban.trang_thai?.[v - 1];
  const xu = t && t.run_huong !== 0 && t.run_dai >= QUAN_TINH.NGUONG_CHUOI ? { huong: t.run_huong, dai: t.run_dai } : null;
  return moiTruongCua(xu);
};
const buocCoKeMau = KICH_BAN.filter((b) => b.keMau !== undefined);
const CHU_MAU = { xuong: 'ĐỎ', len: 'XANH', ngang: 'XÁM' } as const;

describe('II-bis. D445 — mỗi bước `keMau` khớp màu bàn thật, lời gọi đúng tên màu', () => {
  it('⭐ bài dạy màu bàn phủ đủ ba màu, và mở ngay vòng 1', () => {
    expect(new Set(buocCoKeMau.map((b) => b.keMau!.mau))).toEqual(new Set(['xuong', 'len', 'ngang']));
    expect(buocCoKeMau.some((b) => b.keMau!.vong === 1)).toBe(true);
  });

  for (const buoc of buocCoKeMau) {
    const { vong, mau } = buoc.keMau!;
    it(`${buoc.id} (vòng ${vong}) — bàn thật ${CHU_MAU[mau]}`, () => {
      expect(mauBanVong(vong), `bước ${buoc.id} nói bàn ${CHU_MAU[mau]} ở vòng ${vong}`).toBe(mau);
      expect(loiCuaBuoc(buoc, boiCanhMau), `bước ${buoc.id} không gọi tên màu`).toContain(CHU_MAU[mau]);
    });
  }

  it('⭐ D448 — lá mở màn là lá XU HƯỚNG (GIẢM) trên bàn ĐỎ: lá và màu cùng kể một mùa (founder bác lá ĐI NGANG)', () => {
    const o1 = ban.o[0]!;
    expect(o1.kind === 'giai_doan' && o1.giai_doan === 'giam').toBe(true);
    expect(mauBanVong(1)).toBe('xuong');
  });
});

// ─── III. MỌI NEO `muc` PHẢI THẬT SỰ TỒN TẠI TRONG web/src ─────────────────

function moiTsx(thuMuc: string): string[] {
  const ra: string[] = [];
  for (const t of readdirSync(thuMuc)) {
    const d = join(thuMuc, t);
    if (statSync(d).isDirectory()) ra.push(...moiTsx(d));
    else if (t.endsWith('.tsx')) ra.push(d);
  }
  return ra;
}

/** Bóc chú thích TRƯỚC khi quét — chú thích hay trích nguyên văn neo cũ đã gỡ
 *  (vd docstring `dong-ho` nhắc tới `pnl`), quét thô sẽ khớp nhầm chính lời
 *  cảnh báo đó (bẫy đã trả giá ở `alpha_draft_hoi_quy.test.ts`). */
const boc = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const GOC_SRC = (() => {
  const a = join(process.cwd(), 'src');
  try { return statSync(a).isDirectory() ? a : join(process.cwd(), 'web/src'); } catch {
    return join(process.cwd(), 'web/src');
  }
})();

/**
 * Hình dạng tên một neo thật: kebab-case, không gạch dưới, không `$`.
 * Dùng chung cho CẢ HAI nhánh quét — xem lý do đầy đủ ở nhánh biểu thức.
 */
const LA_TEN_NEO = /^[a-z][a-z0-9-]*$/;

const TAT_CA_NEO = new Set<string>();
for (const f of moiTsx(GOC_SRC)) {
  const ma = boc(readFileSync(f, 'utf8'));
  // Neo LITERAL: data-tap="x". Lọc theo cùng hình dạng tên với nhánh biểu
  // thức bên dưới — chuỗi truy vấn `[data-tap="${mucHienTai}"]` trong chính
  // CoachTap khớp regex này y như một neo thật, và nó KHÔNG phải neo.
  for (const m of ma.matchAll(/data-tap="([^"]+)"/g)) {
    if (LA_TEN_NEO.test(m[1]!)) TAT_CA_NEO.add(m[1]!);
  }
  // Neo qua BIỂU THỨC JSX: data-tap={đk ? 'x' : 'y'} (vd ShopManHinh.tsx —
  // một `<section>` dùng chung cho hai mục shop, chọn neo theo `loai`). Bắt
  // MỌI chuỗi nằm trong cặp ngoặc nhọn ngay sau `data-tap=` — thô nhưng đủ,
  // cùng tinh thần quét-bằng-regex của `alpha_draft_hoi_quy.test.ts`.
  for (const m of ma.matchAll(/data-tap=\{([^}]*)\}/g)) {
    for (const lit of m[1]!.matchAll(/['"]([^'"]+)['"]/g)) {
      /*
       * ⚠ 09/09 (D319) — LỌC THEO HÌNH DẠNG TÊN NEO, vì phép quét thô ở trên
       * nhặt về hai loại rác và mục V (phân loại từng neo) thì rác nào cũng
       * thành một dòng đỏ vô nghĩa:
       *  · `data-tap={loai === 'tai_san' ? 'shop-taisan' : 'shop-loi'}` — vế
       *    SO SÁNH `tai_san` không phải một neo;
       *  · `` `[data-tap="${mucHienTai}"]` `` trong chính CoachTap — đó là câu
       *    truy vấn đi TÌM neo, không phải một neo.
       * Mọi neo thật đều kebab-case (`shop-cam-ket`, `ky-ngo-thanh`…): không
       * gạch dưới, không `$`. Đây là một luật đặt tên, nên nếu ai đó đặt neo
       * `tai_san` thật thì bài mục V sẽ im lặng bỏ qua — đổi lại là mục III
       * vẫn bắt được ngay khi có bước rọi vào nó.
       */
      if (LA_TEN_NEO.test(lit[1]!)) TAT_CA_NEO.add(lit[1]!);
    }
  }
}

describe('III. Mọi `muc` (neo data-tap) mà kịch bản rọi vào phải có thật', () => {
  const cacMuc = [...new Set(KICH_BAN.map((b) => b.muc).filter((m): m is string => m !== null))];

  it('⭐ danh sách neo không rỗng (nếu rỗng thì phép quét bên dưới không canh gì)', () => {
    expect(cacMuc.length).toBeGreaterThan(0);
    expect(TAT_CA_NEO.size).toBeGreaterThan(0);
  });

  for (const muc of cacMuc) {
    it(`data-tap="${muc}" tồn tại trong ít nhất một tệp .tsx dưới web/src`, () => {
      expect(
        TAT_CA_NEO.has(muc),
        `neo "${muc}" không tồn tại — một bước coach đang rọi vào chỗ không có thật`,
      ).toBe(true);
    });
  }

  it('⚠ neo "pnl" (đã gỡ theo D184) KHÔNG được coach nào rọi vào', () => {
    expect(cacMuc.includes('pnl')).toBe(false);
  });

  /*
   * ⭐⭐ D312 — NEO PHẢI CÓ MẶT LÚC BƯỚC CHẠY, không chỉ "có tồn tại đâu đó".
   *
   * Phép quét ở trên hỏi *"neo có trong web/src không"* và trả lời ĐÚNG cho một
   * bước hỏng hoàn toàn: bước `ketqua` bảo *"Bấm VÌ SAO"* trong khi rọi vào
   * `data-tap="ketqua"` — tấm lý do, thứ CHỈ được vẽ sau khi `moLyDo` bật. Tức
   * đúng lúc bảo người ta bấm thì không có gì được rọi; founder gửi ảnh 08/09
   * thấy tooltip nằm chỏng chơ giữa đáy màn.
   *
   * Luật bắt được cả họ lỗi, không riêng ca ấy: **một bước chỉ hoàn thành khi
   * người chơi bật một cờ, thì không được rọi vào phần tử chỉ tồn tại sau khi
   * cờ đó đã bật.**
   */
  it('⭐ bước đòi `moLyDo` KHÔNG được rọi vào neo chỉ hiện sau khi moLyDo bật', () => {
    // Neo chỉ sống bên trong khối `moLyDo && (...)` của màn trận.
    const NEO_SAU_KHI_MO = new Set(['ketqua']);
    const boiCanhTat = { ...boiCanhMau, moLyDo: false };
    const boiCanhBat = { ...boiCanhMau, moLyDo: true };
    for (const b of KICH_BAN) {
      const doiMoLyDo = b.tuXong !== undefined
        && b.tuXong(boiCanhBat) === true && b.tuXong(boiCanhTat) === false;
      if (!doiMoLyDo || b.muc === null) continue;
      expect(
        NEO_SAU_KHI_MO.has(b.muc),
        `bước "${b.id}" bảo người chơi bật lý do nhưng lại rọi vào "${b.muc}" — `
        + 'neo ấy chỉ được vẽ SAU khi họ bấm, nên lúc cần chỉ chỗ thì không có gì để chỉ',
      ).toBe(false);
    }
  });
});

// ─── IV. VÒNG KỲ NGỘ CỦA BÀN KHỚP ĐÚNG VỊ TRÍ BƯỚC `ky-ngo` ────────────────

describe('IV. Bàn tập không có kỳ ngộ ⇒ kịch bản không có bước chờ kỳ ngộ (D433)', () => {
  it('luật bàn tập tắt kỳ ngộ, và nhịp chọn bài của nó không có vòng kỳ ngộ', () => {
    expect(luat.kyNgo).toBe(false);
    expect(nhipChonBai(HOLDEM_DECISIONS.MAN_TAP_SO_O, luat.kyNgo, luat.gianLaMapNgan)).not.toContain('ky_ngo');
  });

  /*
   * Bước MẠCH KỂ chờ lời mời kỳ ngộ ở một bàn không có kỳ ngộ = chặn mọi bước sau nó tới hết vòng (lớp "kẹt đầu
   * hàng" 15/09). Tiêm lỗi: thêm lại bước `ky-ngo` cũ vào KICH_BAN ⇒ đỏ.
   */
  it('⭐⭐ không bước mạch kể nào chờ cờ kỳ ngộ', () => {
    const cho = KICH_BAN.filter((b) => b.lan !== 'khi' && b.cho !== undefined
      && b.cho({ ...boiCanhMau, vong: 7, kyNgoMoi: true, kyNgoMo: true }) === true
      && b.cho({ ...boiCanhMau, vong: 7, kyNgoMoi: false, kyNgoMo: false }) === false);
    expect(cho.map((b) => b.id)).toEqual([]);
  });
});

// ─── V. KHÔNG NÚT NÀO LỌT: mọi neo phải ĐƯỢC DẠY hoặc ĐƯỢC MIỄN CÓ LÝ DO ────

/**
 * ⭐⭐ D319 — BÀI CANH TRẢ LỜI ĐÚNG CÂU FOUNDER HỎI 09/09:
 * *"phần hướng dẫn t muốn bạn làm trong màn chơi hướng dẫn (đầy đủ các chức
 * năng hiển thị/button) bạn đã làm chưa?"*
 *
 * Câu trả lời hôm ấy là CHƯA, và điều đáng nói là **không có gì trong repo nói
 * cho tôi biết điều đó**. v43 dựng cả một cơ chế NGÂN HÀNG — panel, ba viên kỳ
 * hạn, thanh trượt, nút gửi, nút huỷ — mà màn tập không nhắc lấy một câu; tsc
 * xanh, 314 tệp test xanh, vì "một cơ chế mới không được dạy" không hỏng cái gì
 * máy đo được. Đúng lớp lỗi mà mục III sinh ra để chống, chỉ ngược chiều: III
 * hỏi *"coach có rọi vào neo ma không"*, mục này hỏi *"có neo nào coach chưa
 * bao giờ rọi tới không"*.
 *
 * Luật: MỌI `data-tap` trong `web/src` phải nằm ở đúng một trong hai rổ —
 * được một bước dạy, hoặc được MIỄN kèm LÝ DO viết ra ở đây. Thêm một nút mới
 * mà không làm gì cả ⇒ ĐỎ, và người thêm phải tự quyết dạy hay miễn. Không có
 * cửa thứ ba "quên".
 *
 * ⚠ Hai chiều, không phải một: danh sách miễn cũng bị canh ngược lại (miễn một
 * neo đã được dạy = danh sách trôi; miễn một neo không còn tồn tại = rác). Một
 * danh sách miễn không ai dọn sẽ lặng lẽ nuốt hết giá trị của bài này.
 */
const MIEN_TRU: Readonly<Record<string, string>> = {
  // ── Ngoài trận: sảnh. Coach chỉ sống trong màn trận (`?tap=1`). ──
  'phong-cho': 'SẢNH — phòng chờ bàn chung, gặp trước khi vào trận, không phải nút trong trận',
  'ru-ban': 'SẢNH — nút rủ bạn vào bàn, không phải cơ chế trong trận',
  'thu-thach-ngay': 'SẢNH — thẻ thử thách ngày, đứng ngoài vòng đời một trận',
  'ket-thu-thach': 'SẢNH — kết thử thách ngày, đứng ngoài vòng đời một trận',

  // ── Màn KẾT: đọc kết quả, không còn nút nào đổi được cục diện. D336: bước `het`
  //    chạy trên chính màn kết nhưng không rọi khối nào (một câu chào, nhuộm đều). ──
  'the-ket-tran': 'MÀN KẾT — thẻ tổng kết trận, không còn quyết định nào để dạy',
  'phong-cach-ket': 'MÀN KẾT — phong cách chơi đúc ra sau trận, chỉ để đọc',
  'dau-moc': 'MÀN KẾT — dấu mốc kỹ năng; nó CỐ Ý không kê trước (xem DauMoc.tsx), '
    + 'nên dạy nó trước trận là phá đúng tính chất nó được sinh ra để giữ',
  'doi-ban': 'MÀN KẾT — đội của bạn, và chỉ có ở bàn chung; bàn tập không phải bàn chung',
  // D433 — bàn tập v54 tắt kỳ ngộ (`kyNgo`): hai neo dưới không bao giờ lên hình ở màn tập; bước `ky-ngo` nghỉ.
  'ky-ngo': 'KỲ NGỘ — lớp phủ chỉ mở ở luật bật `kyNgo` (≤ v53); bàn tập chạy v54 (D433) nên nó không bao giờ lên hình',
  'ky-ngo-thanh': 'thanh kỳ ngộ SAU khi đã chọn — cùng lý do `ky-ngo`: bàn tập v54 không có kỳ ngộ',

  // ── Có trong trận nhưng CỐ Ý không dạy, mỗi cái một lý do đo được ──
  'shop-cam-ket': 'CHẾT từ v43 — `khoaTaiSanTat` bật ⇒ `khoa_duoc` luôn false và '
    + '`khoa.dangChay` luôn null, nên dải này không bao giờ render trên bàn tập v45. '
    + 'Dạy nó là dạy một nút không tồn tại.',
  'bang-xac-thuc': 'KHOÁ SAU TIẾN TRÌNH — chỉ hiện với LƯỚT SÓNG cấp 2, mà người vào '
    + 'màn tập là người mới tinh. Dạy ở đây là hứa một khối họ không thấy.',
  'shop-daxep': 'cùng khối với `shop-lenh` (HangChip) và hiện ngay sau cú bấm chip mà '
    + 'bước ấy yêu cầu — thêm một bước chỉ để nói "lệnh nằm đây" là chữ thừa',
  'shop-vi': 'ví chỉ hiện SỐ, không có nút nào để bấm; bước `ngan-hang` đã đọc tiền mặt ra lời',
  'lang-kinh': 'nằm BÊN TRONG khối xem trước — bước `xem-truoc` rọi vào cả khối, gồm nó',
  'nut-giai-thich': 'dấu (!) trên thẻ chợ chở ĐÚNG bài học D28 mà bước `doc-loi` đã dạy '
    + 'trên lá kỹ năng. Dạy hai lần cùng một luật là chữ thừa, không phải phủ sóng.',
  'ban': 'khung bao cả bàn — bước `vai` đã rọi vào `doi-thu` nằm gọn trong nó',
  'giai-vong': 'D401 — hộp GIẢI là THÔNG TIN (không bấm được), vẽ lại QUỸ VÒNG — thứ bàn tập hiện CHƯA dạy ở bước '
    + 'nào. Dạy nó thuộc đợt viết lại bàn tập 16 cho bánh xe v54 (một mục chặn lật mặc định của D389). ĐIỀU KIỆN '
    + 'GỠ: đợt ấy thêm bước rọi `giai-vong` — bài "đã dạy rồi nhưng vẫn nằm trong MIEN_TRU" ở dưới sẽ đỏ nếu quên.',
  // ── v55 (D409) — LỬA · XU · TRAIT · CHỐT LỜI: chỉ render ở trận chạy khoá `balance-v55-build` (MẶC ĐỊNH từ D434), còn
  //    bàn tập ghim v54 (D433) nên KHÔNG một neo nào dưới đây lên hình ở màn tập. Dạy chúng thuộc đợt viết lại
  //    bàn tập cho v55 (memory: cơ chế mới phải dạy TRONG màn tập). ĐIỀU KIỆN GỠ: đợt ấy thêm bước rọi từng neo — bài
  //    "đã dạy rồi nhưng vẫn nằm trong MIEN_TRU" bên dưới sẽ đỏ nếu quên. ──
  'lua': 'v55 — ngọn lửa đà (thông tin, không bấm); bàn tập v54 không có cổng `lua`',
  'lua-o': 'v55 — khe lửa trên thanh phong cách; cùng lý do `lua`',
  'khay-trait': 'v55 — khay trait đang mang (thông tin); bàn tập v54 không có cổng `trait`',
  'foot-trait': 'v55 — chỗ đặt khay trait dưới thanh phong cách; cùng lý do `khay-trait`',
  'xu': 'v55 — ô xu trong khay (thông tin); cùng lý do `khay-trait`',
  'cho-trait': 'v55 — chợ trait ở MÀN CHỌN của shop, vòng mốc (D432); bàn tập v54 không có vòng mốc',
  'can-trait': 'v55 — cái cân của chợ trait; nằm trong `cho-trait`',
  'cuon-trait': 'v55 — nút ĐỔI TRAIT dưới ô XU của chợ (D526; trước ở đáy màn chọn — D432), chỉ có ở vòng mốc; bàn tập v54 không có vòng mốc',
  'doi-loi': 'D432 → D526 — nút ĐỔI LÕI dưới hai lá lõi trong khung lõi; bàn tập dạy CHỌN lõi, đổi lượt mời là tuỳ chọn không đổi luật',
  'chan-lay-loi': 'D526 — chân tờ chú thích lõi (ĐÓNG · LẤY) khi chạm lá ở màn chọn; nằm trong tờ mở từ `shop-loi`, bước dạy rọi `shop-loi`',
  'lay-loi': 'D526 — nút LẤY LÕI NÀY ở chân tờ; bước `loi-chien-thuat` nói "chạm lá rồi LẤY", tờ che cả màn nên không rọi riêng',
  'khong-lay-loi': 'D526 — nút ĐÓNG (không lấy) ở chân tờ lõi; đi cùng `lay-loi`',
  'oracle-man': 'D527 — dải Oracle TRONG màn minigame của bàn tập minigame (kịch bản `KICH_BAN_MINIGAME` + `loiOracleMan`); bàn tập v54 không có màn',
  'man-chon': 'D432 — khung MÀN CHỌN (neo cho soi/test); bàn tập rọi `shop-loi` nằm TRONG nó ở vòng lõi',
  'vao-ban': 'D432 — nút chính màn chọn (BỎ QUA / VÀO BÀN CƯỢC); chọn lõi (LẤY ở tờ, D526) tự sang bàn nên bàn tập không cần rọi nó',
  've-chon': 'D432 — nút ◆ quay lại màn chọn ở đầu mục TÀI SẢN; chỉ có ở vòng lõi / mốc, tên nút nói đích',
  'tam-trait': 'v55 (D422) — bảng xác nhận khi chạm một thẻ trait; mở từ `cho-trait` / `khay-trait`',
  'nen-tam-trait': 'v55 (D422) — nền mờ của bảng xác nhận (chạm để đóng); đi cùng `tam-trait`',
  'lay-trait': 'v55 (D422) — nút LẤY / NHẬN / BỎ trong bảng xác nhận; đi cùng `tam-trait`',
  'dong-tam-trait': 'v55 (D422) — nút ĐÓNG của bảng xác nhận; đi cùng `tam-trait`',
  'cau-can-tam': 'v55 (D422) — câu "sau lượt này cân …" trong bảng xác nhận (thông tin)',
  'bao-trait': 'v55 (D422) — câu báo ngắn khi bấm XONG (thông tin, tự tắt)',
  'chot-loi': 'v55 — khối chốt lời trong ô, chỉ khi cầm Lướt Sóng ở trận bật `luotSongMoi`',
  'bo-chot-loi': 'v55 — nút BỎ của một lệnh chốt lời; nằm trong `chot-loi`',
  'lich-vong': 'KHÔNG ĐƯỢC MOUNT Ở ĐÂU trong app — `LichVong` bị gỡ khỏi màn trận '
    + 'theo D184 và nay chỉ còn sống nhờ chính bài test của nó (m2_m3_m4.test.tsx). '
    + 'Đo bằng grep 09/09: 0 chỗ gọi dưới web/src ngoài tệp khai nó. Không dạy một '
    + 'khối không lên hình; và dòng này ở lại để lần dọn sau khỏi phải đo lại (A11.13).',
};

describe('V. Không nút nào lọt — mọi neo được dạy hoặc được miễn có lý do', () => {
  const daDay = new Set(KICH_BAN.map((b) => b.muc).filter((m): m is string => m !== null));

  it('⭐ phép quét có gì để quét (rỗng thì bài này không canh gì)', () => {
    expect(TAT_CA_NEO.size).toBeGreaterThan(10);
    expect(daDay.size).toBeGreaterThan(5);
  });

  it('⭐⭐ mọi neo trong web/src đều ĐƯỢC DẠY hoặc ĐƯỢC MIỄN', () => {
    const lot = [...TAT_CA_NEO].filter((n) => !daDay.has(n) && MIEN_TRU[n] === undefined).sort();
    expect(
      lot,
      `neo chưa phân loại: ${lot.join(', ')} — mỗi nút có mặt trên màn phải hoặc được `
      + 'một bước CoachTap dạy, hoặc được thêm vào MIEN_TRU kèm lý do. '
      + '"Quên" không phải một lựa chọn.',
    ).toEqual([]);
  });

  it('⚠ danh sách miễn không chứa neo ĐÃ được dạy (miễn trôi)', () => {
    const thua = Object.keys(MIEN_TRU).filter((n) => daDay.has(n)).sort();
    expect(thua, `đã dạy rồi nhưng vẫn nằm trong MIEN_TRU: ${thua.join(', ')}`).toEqual([]);
  });

  it('⚠ danh sách miễn không chứa neo ĐÃ BIẾN MẤT khỏi web/src (miễn rác)', () => {
    const ma = Object.keys(MIEN_TRU).filter((n) => !TAT_CA_NEO.has(n)).sort();
    expect(ma, `miễn một neo không còn tồn tại: ${ma.join(', ')}`).toEqual([]);
  });

  it('⚠ mọi lý do miễn phải là câu thật, không phải chỗ trống cho qua', () => {
    for (const [neo, ly] of Object.entries(MIEN_TRU)) {
      expect(ly.length, `lý do miễn "${neo}" quá ngắn để là một lý do`).toBeGreaterThan(24);
    }
  });
});

// ─── VI. NGÂN HÀNG PHẢI ĐƯỢC DẠY, VÀ DẠY ĐÚNG LÚC NÓ MỞ ────────────────────

describe('VI. Ngân hàng (v43) được dạy trong màn tập', () => {
  it('có bước rọi vào panel ngân hàng, và nó CHỜ cờ server báo gửi được', () => {
    const buoc = KICH_BAN.find((b) => b.id === 'ngan-hang');
    expect(buoc, 'thiếu bước ngan-hang — cơ chế v43 không được dạy').toBeDefined();
    expect(buoc!.muc).toBe('ngan-hang');
    expect(buoc!.shop, 'panel ngân hàng nằm trong shop ⇒ bước phải mở shop').toBe(true);
    const mo = { ...boiCanhMau, vong: VONG_DAY_NGAN_HANG, shopMo: true, nganHangMo: true };
    expect(buoc!.cho?.(mo), 'phải HIỆN khi server báo gửi được').toBe(true);
    expect(
      buoc!.cho?.({ ...mo, nganHangMo: false }),
      'phải ẨN khi server KHÔNG cho gửi — dạy một nút mờ là dạy sai',
    ).toBe(false);
  });

  it('bước chọn kỳ hạn CHỜ TAY (tuXong), không phải một bước đọc suông', () => {
    const buoc = KICH_BAN.find((b) => b.id === 'ngan-hang-ky');
    expect(buoc, 'thiếu bước ngan-hang-ky').toBeDefined();
    expect(buoc!.muc).toBe('ngan-hang-ky');
    expect(buoc!.tuXong, 'bước hành động phải chờ tay').toBeDefined();
    expect(buoc!.tuXong!({ ...boiCanhMau, chonGui: true })).toBe(true);
    expect(buoc!.tuXong!({ ...boiCanhMau, chonGui: false })).toBe(false);
  });

  it('⚠ mọi bước ngân hàng phải TRÔI khi qua vòng — không đứng chờ vĩnh viễn', () => {
    for (const id of ['ngan-hang', 'ngan-hang-ky']) {
      const b = KICH_BAN.find((x) => x.id === id)!;
      expect(b.troi, `bước ${id} thiếu troi`).toBeDefined();
      expect(
        b.troi!({ ...boiCanhMau, vong: HOLDEM_DECISIONS.MAN_TAP_SO_O }),
        `bước ${id} không trôi khi vòng đã qua — coach treo tới hết trận`,
      ).toBe(true);
    }
  });

  /**
   * ⭐⭐ THẾ TỰ KHOÁ — lỗi tôi tự viết ra ở D319 rồi tự bắt lại khi đọc kỹ
   * `CoachTap`. Hiệu ứng dàn cảnh shop có `if (!hien) return`, mà `hien` tắt
   * ngay khi `cho` trả false. Nên một bước `shop: true` có `cho` đòi `b.shopMo`
   * sẽ đứng chờ shop mở, trong khi thứ đáng lẽ mở shop là chính nó — bước
   * không bao giờ chạy, và im lặng: `troi` dọn nó đi khi hết vòng.
   *
   * Chỉ canh các bước D319 dựng (`bo` dưới đây), KHÔNG canh cả kịch bản:
   * `loi-chien-thuat` và `doc-loi` CỐ Ý chờ người chơi tự vào shop, và đó là
   * một ý định khác chứ không phải cùng một lỗi.
   */
  it('⭐⭐ bước ngân hàng KHÔNG tự khoá — hiện được cả khi shop đang đóng', () => {
    const bo = ['ngan-hang', 'ngan-hang-ky'];
    for (const id of bo) {
      const b = KICH_BAN.find((x) => x.id === id)!;
      expect(b.shop, `bước ${id} phải tự mở shop`).toBe(true);
      expect(
        b.cho?.({
          ...boiCanhMau, vong: VONG_DAY_NGAN_HANG, nganHangMo: true, shopMo: false,
        }),
        `bước ${id} đòi shop mở sẵn trong khi chính nó là thứ mở shop — `
        + 'nó sẽ không bao giờ chạy, và không có lỗi nào bắn ra',
      ).toBe(true);
    }
  });

  /*
   * D433 — đếm theo số VÒNG thật (server `soVong`): luật ô úp có lá mở màn ⇒ 12 ô = 11 vòng. Đếm theo số ô (như
   * `kipDaoHanTietKiem` của engine) thì vòng 9 "đủ ba mốc" trong khi mốc 4 ô đáo hạn ở một vòng không tồn tại.
   * Tiêm lỗi: `VONG_DAY_NGAN_HANG = 9` ⇒ đỏ.
   */
  it('⭐ vòng dạy ngân hàng còn ĐỦ BA MỐC kỳ hạn đáo hạn trong số VÒNG của bàn', () => {
    const soVongTap = HOLDEM_DECISIONS.MAN_TAP_SO_O - (luat.oUp ? 1 : 0);
    const moc = TIET_KIEM.MOC.filter(
      (n) => VONG_DAY_NGAN_HANG + n - 1 <= soVongTap,
    );
    expect(
      moc.length,
      'dạy ở vòng mà mốc dài không còn kịp ⇒ người chơi thấy panel thiếu viên, '
      + 'và câu "kỳ dài lãi cao hơn" chỉ vào chỗ trống',
    ).toBe(TIET_KIEM.MOC.length);
  });
});

/*
 * ═══ VI. NEO PHẢI SỐNG ĐÚNG LÚC BƯỚC ẤY CHẠY ═══════════════════════════════
 *
 * ⚠⚠ LỚP LỖI NÀY ĐÃ SỐNG BỐN NGÀY VÀ KHÔNG MỘT BÀI NÀO ĐỎ (08→12/09).
 * Mục V hỏi "neo có tồn tại trong web/src không" — câu trả lời vẫn là CÓ, vì neo
 * nằm trên một cái nút có thật. Thứ nó không hỏi: *lúc bước ấy chạy thì cái nút
 * đó có đang được vẽ không*. Nút VÌ SAO của khối kết quả nằm trong khối
 * `… && moLyDo && (`, tức chỉ sống khi lý do ĐÃ mở; mà bước `ketqua` tồn tại để
 * bảo người chơi MỞ nó. Hệ quả trên máy founder: màn nhuộm đều, không ô nào sáng,
 * và vì bước chờ tay (`tuXong: moLyDo === true`) nên không có cả nút TIẾP — kẹt
 * cứng, chỉ còn đường BỎ QUA.
 *
 * Bất biến canh ở đây: **neo của một bước phải nằm NGOÀI cái cổng mà chính bước
 * ấy có nhiệm vụ mở.** Kiểm bằng nguồn: neo `vi-sao` chỉ được xuất hiện MỘT lần
 * trong màn trận, và lần ấy phải nằm trong cụm `nhipPhai` của thanh tay cầm —
 * khối luôn hiện khi có kết quả vòng (D119: cửa duy nhất tới bảng VÌ SAO).
 */
describe('VI. Neo sống đúng lúc bước chạy', () => {
  const MAN = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
  const maMan = boc(MAN);

  it('⭐⭐ neo `vi-sao` chỉ có MỘT, và nằm trong cụm số ở thanh tay cầm', () => {
    const lan = maMan.match(/data-tap="vi-sao"/g) ?? [];
    expect(lan.length, 'hai neo cùng tên ⇒ querySelector lấy cái đầu DOM, '
      + 'và cái đầu lại là cái nằm sau cổng `moLyDo`').toBe(1);
    const cum = /nhipPhai=\{[\s\S]{0,2000}?\n\s{10}\)\s:\sundefined\}/.exec(maMan)?.[0] ?? '';
    expect(cum, 'không tìm thấy cụm `nhipPhai`').not.toBe('');
    expect(cum, 'neo `vi-sao` phải ở cụm luôn hiện, không ở khối chờ `moLyDo`')
      .toContain('data-tap="vi-sao"');
  });

  it('⭐ nút VÌ SAO trong khối kết quả KHÔNG mang neo (nó sống sau cổng `moLyDo`)', () => {
    const nut = /<button[\s\S]{0,200}?className=\{s\.nutLyDo\}[\s\S]{0,300}?<\/button>/.exec(maMan)?.[0] ?? '';
    expect(nut, 'không tìm thấy nút VÌ SAO của khối kết quả').not.toBe('');
    expect(nut, 'neo trên nút này là neo chết: bước `ketqua` chạy khi nó chưa được vẽ')
      .not.toContain('data-tap');
  });

  it('⭐ bước `ketqua` chờ tay ⇒ BẮT BUỘC có neo (không neo = kẹt, không cả nút TIẾP)', () => {
    const b = KICH_BAN.find((x) => x.id === 'ketqua');
    expect(b, 'mất bước `ketqua`').toBeDefined();
    expect(b!.tuXong, 'bước này vốn là bước chờ tay').toBeDefined();
    expect(b!.muc, 'bước chờ tay mà không rọi vào đâu thì người chơi không biết bấm gì')
      .toBe('vi-sao');
  });
});

/*
 * ═══ VII. `cho` VÀ `tuXong` KHÔNG ĐƯỢC LOẠI TRỪ NHAU ═══════════════════════
 *
 * Lớp lỗi đã cắn HAI LẦN trong một ngày (12/09): `chia-vai` và `mo-shop-loi`.
 * Hình dạng: `cho` đòi một cờ TẮT (`!b.shopMo`) trong khi `tuXong` đòi chính cờ
 * ấy BẬT. Người chơi làm đúng việc được bảo ⇒ cờ bật ⇒ `cho` thành false ⇒
 * `hien` false ⇒ mà `tuXong` chỉ chạy khi `hien` (`if (hien && buoc.tuXong(b))`)
 * ⇒ bước KHÔNG BAO GIỜ chuyển. Trợ lý biến mất không dấu vết, không lỗi nào bắn.
 *
 * Bài này đọc chính mã của hai hàm (`Function.prototype.toString`) nên nó canh
 * được MỌI bước, kể cả bước viết sau này — không phải bắt từng ca.
 * Tiêm lỗi: thêm `&& !b.shopMo` vào `cho` của `mo-shop-loi` ⇒ đỏ.
 */
describe('VII. Không bước nào tự khoá', () => {
  const CO = [
    'shopMo', 'moLyDo', 'chonLoi', 'bangMo', 'coKetQua', 'moLaiSuat',
    'shopCoLenh', 'shopChonMa', 'kyNgoDaChon', 'nganHangMo', 'chonGui',
  ] as const;

  it('⭐⭐ `cho` đòi cờ TẮT trong khi `tuXong` đòi cờ ấy BẬT ⇒ bước chết câm', () => {
    const loi: string[] = [];
    for (const b of KICH_BAN) {
      if (!b.cho || !b.tuXong) continue;
      const c = b.cho.toString();
      const t = b.tuXong.toString();
      for (const co of CO) {
        const choDoiTat = c.includes(`!b.${co}`);
        const xongDoiBat = t.includes(`b.${co}`) && !t.includes(`!b.${co}`);
        if (choDoiTat && xongDoiBat) {
          loi.push(`${b.id}: cho đòi !${co} còn tuXong đòi ${co}`);
        }
      }
    }
    expect(loi, `bước tự khoá — làm xong việc là bước biến mất trước khi kịp chuyển:\n${loi.join('\n')}`)
      .toEqual([]);
  });

  it('⭐ `giuShop` không được bật ở bước mà ĐÓNG shop là cách xong bước', () => {
    // `giuShop` mở lại shop suốt bước. Bật nó ở bước có `tuXong` đọc `!b.shopMo`
    // (vd `chot`: cất shop LÀ cách xong bước) là trợ lý giành nút với người chơi.
    const loi = KICH_BAN
      .filter((b) => b.giuShop === true && b.tuXong !== undefined)
      .filter((b) => b.tuXong!.toString().includes('!b.shopMo'))
      .map((b) => b.id);
    expect(loi, 'trợ lý mở lại shop trong khi người chơi đóng shop để xong bước').toEqual([]);
  });

  it('⭐ bước `shop: true` mà `cho` lại đòi `b.shopMo` ⇒ thế tự khoá đã ghi trong docstring', () => {
    const loi = KICH_BAN
      .filter((b) => b.shop === true && b.cho !== undefined)
      .filter((b) => {
        const c = b.cho!.toString();
        return c.includes('b.shopMo') && !c.includes('!b.shopMo');
      })
      .map((b) => b.id);
    expect(loi, 'bước chờ shop mở trong khi chính nó là thứ mở shop (dàn cảnh nằm sau `if (!hien) return`)')
      .toEqual([]);
  });
});

/*
 * ═══ VIII. BƯỚC NGAY SAU CHỐT PHẢI GIỮ SHOP ĐÓNG ═══════════════════════════
 * Sau mỗi cú chốt, `shopMoLucLat` (AlphaDraftMatch) đóng shop để lật ô rồi MỞ LẠI
 * khi pha QUYẾT bắt đầu — một phát, nhưng bắn SAU KHI bước đã vào. Bước rọi vào
 * thứ trên MẶT BÀN (dải sáu mã, cụm VÌ SAO) mà chỉ khai `shop: false` thì dàn cảnh
 * lúc vào bước xong là hết việc; shop mở lại ⇒ đèn rọi đâm vào lớp shop. Đo trên tab
 * thật 12/09: chốt +4,5 s ⇒ shopMo=true, ô sáng bước 9 nằm đè hai lá chiến thuật.
 * ⇒ Mọi bước có `cho` đọc `coKetQua` (= "ngay sau chốt") và neo NGOÀI shop phải
 * khai CẢ `shop: false` LẪN `giuShop: true`. Tiêm lỗi: bỏ `giuShop` ở `thi-truong` ⇒ đỏ.
 */
describe('VIII. Bước ngay sau chốt giữ shop đóng', () => {
  it('⭐⭐ cho đọc coKetQua + neo ngoài shop ⇒ shop:false VÀ giuShop:true', () => {
    const loi = KICH_BAN
      .filter((b) => b.lan !== 'khi')
      .filter((b) => b.cho !== undefined && b.cho.toString().includes('coKetQua'))
      .filter((b) => b.muc !== null && !/^(shop-|ngan-hang)/.test(b.muc))
      .filter((b) => b.shop !== false || b.giuShop !== true)
      .map((b) => b.id);
    expect(loi, 'shop tự mở lại sau chốt sẽ đè lên neo của bước này').toEqual([]);
  });

  /*
   * D336 — làn KHI XẢY RA nổ vào lúc bất kỳ, nên nó KHÔNG được dàn cảnh shop (giành shop
   * khỏi tay người đang đặt lệnh). Đổi lại: neo ngoài shop thì nó phải CHỜ người chơi tự
   * cất shop (`cho` đòi `!b.shopMo`) — không thì rọi vào thứ đang bị shop che.
   * Tiêm lỗi: bỏ `&& !b.shopMo` khỏi `tin-truoc` ⇒ đỏ.
   */
  it('⭐ bước làn khi-xảy-ra không dàn cảnh shop, và neo ngoài shop thì chờ shop đóng', () => {
    const loi: string[] = [];
    for (const b of KICH_BAN.filter((x) => x.lan === 'khi')) {
      if (b.shop !== undefined || b.giuShop !== undefined) loi.push(`${b.id}: dàn cảnh shop`);
      const ngoaiShop = b.muc !== null && !/^(shop-|ngan-hang)/.test(b.muc);
      if (ngoaiShop && !String(b.cho).includes('!b.shopMo')) loi.push(`${b.id}: không chờ shop đóng`);
    }
    expect(loi).toEqual([]);
  });
});

/*
 * ═══ IX. TẤM TRƯỢT TRONG SHOP — BƯỚC PHẢI DÀN CẢNH ĐÚNG TẤM (D321) ═════════
 * Shop bốn tầng không cuộn: ngân hàng dời vào TẤM TRƯỢT từ đáy. Hai lớp lỗi cùng
 * họ với tấm VÌ SAO (12/09): (a) bước dạy ngân hàng mà không mở tấm ⇒ neo
 * `ngan-hang` nằm trong thứ chưa vẽ ⇒ rọi vào hư không; (b) bước rọi vào nỉ/chip
 * mà tấm còn mở ⇒ rọi vào thứ bị che. Bài này canh cả hai bằng cấu trúc kịch bản.
 * Tiêm lỗi: bỏ `tam: 'bank'` ở `ngan-hang` ⇒ bài (a) đỏ.
 */
describe('IX. Tấm trượt trong shop được dàn cảnh đúng', () => {
  it('⭐⭐ (a) bước neo vào ngân hàng phải khai tam: "bank"', () => {
    const loi = KICH_BAN
      .filter((b) => b.muc !== null && /^ngan-hang/.test(b.muc))
      .filter((b) => b.tam !== 'bank')
      .map((b) => b.id);
    expect(loi, 'neo ngân hàng nằm trong tấm trượt — không mở tấm là rọi vào hư không').toEqual([]);
  });

  it('⭐ (b) bước neo vào nỉ / chip / chốt trong shop phải khai tam: null', () => {
    const loi = KICH_BAN
      .filter((b) => b.muc !== null && /^shop-(taisan|lenh|xemtruoc|chot|loi)$/.test(b.muc))
      .filter((b) => b.tam !== null)
      .map((b) => b.id);
    expect(loi, 'tấm trượt còn mở sẽ che neo của bước này').toEqual([]);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * X. BƯỚC "DẠY ĐÚNG LÚC" KHÔNG ĐƯỢC TREO BÀN TẬP (13/09)
 *
 * Founder 13/09: màn tập chưa hề dạy trượt giá và chưa hề dạy chuyện đám đông
 * đổi sự kiện. Ba bước mới (`tin-truoc` · `dam-dong-be-o` · `truot-gia`) chờ
 * những thứ PHỤ THUỘC CÁCH CHƠI chứ không phụ thuộc số vòng: người chơi mua
 * khác đi thì cán cân đổi và cú bẻ ô có thể không bao giờ tới.
 *
 * ⚠ Một bước như thế mà thiếu `troi` sẽ đứng chờ vĩnh viễn, và vì kịch bản là
 * DÃY nên nó chôn luôn mọi bước sau — cả nửa cuối bàn tập câm. Đây đúng lớp lỗi
 * "trợ lý chết câm" đã trả giá ở mục VI/VII, chỉ khác nguyên nhân.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('X. Bước chờ trạng thái phụ thuộc cách chơi phải có đường TRÔI', () => {
  const THEO_CACH_CHOI = ['tin-truoc', 'dam-dong-be-o', 'truot-gia', 'tin-gia-lo'];

  it('⭐ ba bước dạy-đúng-lúc đều có mặt trong kịch bản', () => {
    const co = KICH_BAN.map((b) => b.id);
    for (const id of THEO_CACH_CHOI) expect(co, `thiếu bước ${id}`).toContain(id);
  });

  /*
   * ⚠⚠ 15/09 (D336) — "CÓ `troi`" KHÔNG ĐỦ, và bài dưới đây xanh suốt thời gian Oracle câm
   * từ vòng 8 tới vòng 11. `dam-dong-be-o` có `troi: vong > 11` — nó trôi, ở vòng 12 — còn
   * vì kịch bản là MỘT CON TRỎ nên năm bước sau nó (cả bài ngân hàng) chờ theo. Luật đúng:
   * bước chờ thứ phụ thuộc cách chơi phải ở làn KHI XẢY RA, nơi nó không chặn ai.
   * Bài dòng thời gian đầy đủ ở `coach_dong_thoi_gian.test.ts`.
   * Tiêm lỗi: bỏ `lan: 'khi'` ở `dam-dong-be-o` ⇒ đỏ ở đây VÀ ở bài dòng thời gian.
   */
  it('⭐⭐ các bước ấy nằm ở làn khi-xảy-ra — không bao giờ quay lại mạch kể', () => {
    for (const id of THEO_CACH_CHOI) {
      expect(KICH_BAN.find((x) => x.id === id)!.lan, `${id} đứng trong mạch kể sẽ chặn cả hàng sau nó`)
        .toBe('khi');
    }
  });

  it('⭐⭐ mỗi bước ấy có CẢ `cho` lẫn `troi` — thiếu `troi` là bàn tập treo', () => {
    for (const id of THEO_CACH_CHOI) {
      const b = KICH_BAN.find((x) => x.id === id)!;
      expect(typeof b.cho, `${id} không chờ gì thì nó không phải "đúng lúc"`).toBe('function');
      expect(typeof b.troi, `${id} thiếu \`troi\`: không xảy ra ⇒ chôn mọi bước sau`).toBe('function');
    }
  });

  it('⭐ `cho` của chúng đọc CỜ DỮ LIỆU, không đọc số vòng', () => {
    /*
     * Ghim vòng là ghim một thứ sẽ trôi: bộ ô đổi theo `balance_version`, và cú
     * bẻ ô còn phụ thuộc cả bàn mua gì. Bài này bắt cú "sửa cho dễ" thành
     * `b.vong === 7`.
     */
    for (const id of THEO_CACH_CHOI) {
      const b = KICH_BAN.find((x) => x.id === id)!;
      expect(String(b.cho), `${id} quay lại ghim số vòng`).not.toMatch(/\bvong\s*===/);
    }
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * XI. LỜI KỂ TÍNH CHẤT TÀI SẢN KHỚP MA TRẬN ĐANG CHẠY (D336 lượt 2, 15/09)
 *
 * Founder 15/09: *"chơi xong hết màn hướng dẫn mà vẫn chưa biết tính chất của các loại tài sản …
 * chẳng có chỗ nào giải thích tài sản nào sẽ hưởng lợi/ bị giảm hay vì sao"*. Từ lượt này Oracle nói
 * phe nào lên, phe nào xuống ở mỗi tin lớn. Một câu như thế mà sai là DẠY SAI tiền — tệ hơn không dạy.
 *
 * ⚠ Bằng chứng lớp lỗi có thật, ngay trong tệp này: chú thích của `rui-ro-ky-hop` (D336 lượt 1) chép tay
 * "VN30 · Vàng −12%, USDT +18%" — số của ma trận v40, trong khi trận v45 đọc bảng V42 (VN30 −15%,
 * Vàng −3%, USDT +12%). Chú thích không ai chạy nên không ai thấy.
 * ⇒ Mỗi bước kể chiều tài sản KHAI `noiChieu`; bài này tra từng lời khai trong ma trận của luật đang
 * chạy (`boMaTranCua(luat)` — `luat` của khoá bàn tập, cùng cửa engine dùng), và đòi lời có mặt tên
 * thứ nó khai. Tiêm lỗi: đổi `len: ['usd']` của `chuyen-v9` thành `xuong: ['usd']` ⇒ đỏ.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('XI. Oracle kể phe/mã lên xuống ĐÚNG ma trận của luật đang chạy', () => {
  const bo = boMaTranCua({ lop_vn: luat.lopVn, tai_san_v42: luat.taiSanV42 });
  const mtSk = mtSuKien(bo);
  const mtGd = mtGiaiDoan(bo);
  const maCua = (x: string): string[] => (x === 'rui_ro' || x === 'phong_thu'
    ? TAI_SAN.filter((t) => t.nhom === x).map((t) => t.id) : [x]);
  const tenCua = (x: string): string => (x === 'rui_ro' ? 'RỦI RO' : x === 'phong_thu' ? 'PHÒNG THỦ'
    : (TAI_SAN.find((t) => t.id === x)?.label ?? x).split(' ').slice(0, 2).join(' '));
  const coNoi = KICH_BAN.filter((b) => (b.noiChieu?.length ?? 0) > 0);

  it('⭐ có bước kể tính chất (rỗng ⇒ bài này không canh gì) — và đủ bốn mốc: hai phe · hạ lãi · bong bóng · tăng lãi', () => {
    const moc = new Set(coNoi.flatMap((b) => b.noiChieu!.map((n) => n.su_kien ?? `gd:${n.giai_doan}`)));
    for (const m of ['gd:tang', 'gd:giam', 'ha_lai_suat', 'bong_bong', 'tang_lai_suat']) {
      expect(moc.has(m), `không bước nào kể tính chất tài sản ở mốc "${m}"`).toBe(true);
    }
  });

  for (const buoc of coNoi) {
    it(`${buoc.id} — mọi chiều khai ra đúng dấu trong ma trận, và lời gọi tên thứ nó khai`, () => {
      const loi = loiCuaBuoc(buoc, boiCanhMau);
      for (const n of buoc.noiChieu!) {
        const hang = (ma: string): number => {
          const v = n.su_kien !== undefined
            ? mtSk[ma]?.[n.su_kien as keyof (typeof mtSk)[string]]
            : mtGd[ma]?.[n.giai_doan as keyof (typeof mtGd)[string]];
          if (v === undefined) throw new Error(`${buoc.id}: ma trận không có ô ${ma} × ${n.su_kien ?? n.giai_doan}`);
          return v;
        };
        for (const x of n.len ?? []) {
          for (const ma of maCua(x)) {
            expect(hang(ma), `${buoc.id}: nói "${x}" LÊN khi ${n.su_kien ?? n.giai_doan}, mà ${ma} = ${hang(ma)}`)
              .toBeGreaterThan(0);
          }
          expect(loi.toLocaleLowerCase('vi-VN')).toContain(tenCua(x).toLocaleLowerCase('vi-VN'));
        }
        for (const x of n.xuong ?? []) {
          for (const ma of maCua(x)) {
            expect(hang(ma), `${buoc.id}: nói "${x}" XUỐNG khi ${n.su_kien ?? n.giai_doan}, mà ${ma} = ${hang(ma)}`)
              .toBeLessThan(0);
          }
          expect(loi.toLocaleLowerCase('vi-VN')).toContain(tenCua(x).toLocaleLowerCase('vi-VN'));
        }
      }
    });
  }

  it('⭐ bước vẽ dải MỨC của một tin thì phải khai chiều của CHÍNH tin ấy (dải và lời cùng một ô ma trận)', () => {
    for (const b of KICH_BAN) {
      if (b.hinh?.loai !== 'su_kien') continue;
      const id = b.hinh.id;
      expect(b.noiChieu?.some((n) => n.su_kien === id), `${b.id} vẽ dải "${id}" mà lời không khai chiều của tin ấy`)
        .toBe(true);
      expect(SU_KIEN.some((sk) => sk.id === id), `${b.id} vẽ dải cho tin không có thật "${id}"`).toBe(true);
    }
  });

  /*
   * Câu vòng 4 gọi tên ĐÒN BẨY — lá ấy phải thật sự nằm trên quầy lõi vòng 4 của bàn tập. Bàn tập ghim
   * bộ lõi theo seed (`MAN_TAP_LOI_GIAN`); đổi bảng ghim mà quên lời là Oracle giới thiệu một lá không có.
   * Tiêm lỗi: đổi `MAN_TAP_LOI_GIAN[4]` bỏ `don_bay` ⇒ đỏ.
   */
  it('⭐ `loi-don-bay` nói ĐÒN BẨY ⇒ quầy lõi vòng 4 của bàn tập có Đòn Bẩy', () => {
    const b = KICH_BAN.find((x) => x.id === 'loi-don-bay');
    expect(b, 'mất bước loi-don-bay').toBeDefined();
    expect(nhipChonBai(HOLDEM_DECISIONS.MAN_TAP_SO_O, luat.kyNgo, luat.gianLaMapNgan)[3]).toBe('chien_thuat');
    // D433 — đúng tuỳ chọn server bày shop (`tuyChonShop(st)`): v54 lõi gọn ⇒ bảng ghim `MAN_TAP_LOI_GON`.
    const quay = bayShop(seed, 4, 'ban', 0, { tai_san: [], chien_thuat: [] },
      { gianLa: luat.gianLaMapNgan, loiGon: luat.loiGon });
    expect(quay.chien_thuat).toContain('don_bay');
    expect(loiCuaBuoc(b!, boiCanhMau)).toMatch(/ĐÒN BẨY/);
  });
});

describe('XII. D448 — Oracle không nói XÁC SUẤT / độ dài mùa bằng số (founder 28/09)', () => {
  /*
   * Founder: *"oracle ko nói xác suất cụ thể, dễ dính đòn (giáo dục ko thực tiễn) chỉ dự đoán xu hướng dựa trên lá đang
   * được lật thôi"*. D445 viết "8 lần trong 10" · "8 phần 10 … mỗi thứ 1 phần" · "2–3 ô" — số của bánh xe trong game, không
   * phải của chợ thật, và nói ra như luật đời là dạy sai. Lời Oracle TẢ hướng bằng chữ (nghiêng về, thường chưa dứt…).
   */
  const CAM: readonly RegExp[] = [
    /\d+\s*lần\s*trong\s*\d+/i, /\d+\s*phần\s*\d+/i, /\d+\s*phần\b/i, /\d+\s*\/\s*10\b/,
    /\d+\s*[–-]\s*\d+\s*ô(?!\p{L})/iu, /xác suất/i, /\d+\s*%\s*(khả năng|cơ hội)/i,
  ];
  it('⭐ không lời nào của kịch bản chứa tỷ lệ hay độ dài mùa bằng số', () => {
    const vi = KICH_BAN
      .map((b) => ({ id: b.id, loi: loiCuaBuoc(b, boiCanhMau) }))
      .filter((x) => CAM.some((r) => r.test(x.loi)));
    expect(vi.map((x) => `${x.id}: ${x.loi}`), 'Oracle nói xác suất / số ô bằng con số').toEqual([]);
  });
  it('vế ngược: mẫu cấm bắt được đúng ba câu D445 đã bị bác (bài không rỗng)', () => {
    for (const cau of [
      'lá pha khớp mùa 8 lần trong 10, lá này rơi vào 2 lần lệch.',
      'mùa SUY THOÁI ra GIẢM 8 phần 10, ĐI NGANG hay QUÁ NÓNG mỗi thứ 1 phần.',
      'Suy thoái thường chỉ 2–3 ô, và mùa này chạy từ trước khi bạn vào bàn.',
    ]) expect(CAM.some((r) => r.test(cau)), cau).toBe(true);
  });
  it('lá mở màn là lá XU HƯỚNG (pha có hướng) hoặc SỰ KIỆN — không phải ĐI NGANG', () => {
    const b = KICH_BAN.find((x) => x.id === 'la-mo-man');
    expect(b?.keO?.vong).toBe(1);
    expect(b?.keO && 'giai_doan' in b.keO ? b.keO.giai_doan : 'su_kien').not.toBe('di_ngang');
  });
});
