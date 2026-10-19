/**
 * BẺ CHUỖI VĨ MÔ BẰNG VỐN v35 (D160) — founder 29/08: *"chính player cũng có
 * thể bẻ chuỗi vĩ mô nếu hành động của cả lobby (phần lớn vốn) phi lý và tập
 * trung, hoặc ai có role cá mập thì tác động nhẹ nếu tập trung (tính bằng
 * lượng vốn được dùng)"* + chốt "phi lý = CẢ HAI" (ngược chuỗi VÀ ngược môi
 * trường tiền tệ).
 *
 *   §I   CỔNG — false mọi entry trừ v35.
 *   §II  MÁY DÒ — "cả hai" đúng nghĩa cả hai; ⭐⭐ ĐẾM VỐN KHÔNG ĐẾM ĐẦU (khác
 *        phản thân D4 — đúng chỗ D107 từng bác đếm-tiền cho crowding, cơ chế
 *        KHÁC nên đo riêng); khống không tính vào phe.
 *   §III MÁY ÁP — seeded chắc chắn (có seed nổ, có seed im); NHƯỜNG phản thân;
 *        không bẻ ô bị telegraph hứa; chỉ bẻ Ô PHA; immutable.
 *   §IV  CÁ MẬP — cộng nhẹ khi tập trung, tính bằng vốn.
 */
import { describe, expect, it } from 'vitest';
import {
  BE_CHUOI_VON, BO_LUAT_THEO_PHIEN_BAN, luatCua, moiTruongTienTe,
} from '../config/holdem.js';
import {
  apBeChuoiVon, beChuoiCuaLobby, taoTran, xsBeChuoiCua,
  type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';

const ghe = (n: number): GheMoi[] => Array.from({ length: n }, (_, i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));
const gd = (g: string) => ({ kind: 'giai_doan', giai_doan: g }) as never;
const sk = (id: string, gia = false) =>
  ({ kind: 'su_kien', su_kien: id, la_tin_gia: gia, bao_truoc: 'tang' }) as never;

// Mức lãi cho từng môi trường — DÒ từ chính hàm, không chép ngưỡng (D61).
const diemCua = (mt: string): number => {
  // Thang là bp: SAN 0 · KHỞI ĐIỂM 400 · TRẦN 1200.
  for (let d = 0; d <= 1200; d += 50) if (moiTruongTienTe(d) === mt) return d;
  throw new Error(`không tìm được mức lãi cho môi trường ${mt}`);
};

/** Dựng st tay: map 8 (không vai tự gán), rồi đè ô + môi trường + ví ghế. */
function dungSt(opts: {
  o: unknown[]; mt: string; viThe: Record<string, number>[];
  vai?: (string | undefined)[]; seed?: number; luat?: Record<string, unknown>;
}): TrangThaiTran {
  const st = taoTran(opts.seed ?? 1, ghe(opts.viThe.length),
    { ...luatCua('balance-v35-chuoi'), ...(opts.luat ?? {}) } as never, 8);
  const diem = diemCua(opts.mt);
  return {
    ...st,
    map: {
      ...st.map, o: opts.o as never,
      trang_thai: opts.o.map(() => ({ lai_suat_diem: diem })) as never,
    },
    ghe: st.ghe.map((g, i) => ({
      ...g, von: 100, vi_the: opts.viThe[i] ?? {},
      danh_muc: { ...g.danh_muc, tai_san: Object.keys(opts.viThe[i] ?? {}) },
      ...(opts.vai?.[i] !== undefined ? { vai: opts.vai[i] as never } : {}),
    })),
  };
}

// Cảnh chuẩn: chuỗi GIẢM 2 ô + môi trường ĐẮT + phần lớn vốn dồn RISK-ON.
const O_GIAM = [gd('giam'), gd('giam'), gd('di_ngang'), gd('tang')];
const VI_DON_RUI_RO = [{ btc: 9000 }, { vang: 100 }, { vang: 100 }, { vang: 100 }];

describe('I. Cổng', () => {
  it('⭐⭐ beChuoiVon = false ở TỪNG entry trừ v35', () => {
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
        expect(luat.beChuoiVon, `phiên bản CŨ "${ten}" bật cờ ⇒ đổi map trận đã lưu`)
          .not.toBe(true);
      } else {
        // D389 — v54 cắt cụm đám đông đổi lá (bản đồ chỉ do seed quyết): từ v54 TẮT.
        expect(luat.beChuoiVon, `phiên bản "${ten}" từ mốc tới trước v54 bật, từ v54 tắt`)
          .toBe(soCua(ten) < 54);
      }
    }
    expect(luatCua('phien-ban-khong-ton-tai').beChuoiVon).toBe(false);
  });
});

describe('II. Máy dò — "phi lý = cả hai", đếm vốn', () => {
  it('⭐⭐ chuỗi giảm + môi trường ĐẮT + vốn dồn risk-on ⇒ bẻ LÊN', () => {
    expect(beChuoiCuaLobby(dungSt({ o: O_GIAM, mt: 'dat', viThe: VI_DON_RUI_RO }), 3))
      .toBe('len');
  });

  it('⭐⭐ ĐẾM VỐN, KHÔNG ĐẾM ĐẦU: 3/4 ghế cầm phòng thủ nhưng một ví khổng lồ ôm risk-on ⇒ vẫn bẻ', () => {
    /*
     * Đây là bài chịu lực phân biệt nó với phản thân D4 (đếm ghế): cùng cảnh
     * này, demTheoMa thấy 3 ghế phòng thủ vs 1 ghế risk-on — máy ghế nói
     * "trốn"; máy VỐN nói 9000/9400 NAV đang phi lý. Ai "dọn cho gọn" bằng
     * demTheoMa là đổi máy này thành bản sao phản thân.
     */
    const st = dungSt({ o: O_GIAM, mt: 'dat', viThe: VI_DON_RUI_RO });
    expect(beChuoiCuaLobby(st, 3)).toBe('len');
  });

  it('⭐ MỘT vế không đủ: môi trường trung tính ⇒ null; môi trường CÙNG phe đám đông ⇒ null', () => {
    expect(beChuoiCuaLobby(dungSt({ o: O_GIAM, mt: 'trung_tinh', viThe: VI_DON_RUI_RO }), 3))
      .toBeNull();
    // chuỗi giảm nhưng tiền RẺ: mua risk-on lúc này là đầu cơ CÓ CƠ SỞ
    // (môi trường ủng hộ) — không phải phi lý, không bẻ được gì.
    expect(beChuoiCuaLobby(dungSt({ o: O_GIAM, mt: 're', viThe: VI_DON_RUI_RO }), 3))
      .toBeNull();
  });

  it('chiều ngược: chuỗi TĂNG + tiền RẺ + vốn dồn PHÒNG THỦ ⇒ bẻ XUỐNG', () => {
    const st = dungSt({
      o: [gd('tang'), gd('tang'), gd('di_ngang'), gd('giam')], mt: 're',
      viThe: [{ vang: 9000 }, { btc: 100 }, { btc: 100 }, { btc: 100 }],
    });
    expect(beChuoiCuaLobby(st, 3)).toBe('xuong');
  });

  it('chuỗi mới 1 ô ⇒ chưa có gì để bẻ; cờ tắt ⇒ câm', () => {
    expect(beChuoiCuaLobby(dungSt({
      o: [gd('di_ngang'), gd('giam'), gd('di_ngang')], mt: 'dat', viThe: VI_DON_RUI_RO,
    }), 3)).toBeNull();
    expect(beChuoiCuaLobby(dungSt({
      o: O_GIAM, mt: 'dat', viThe: VI_DON_RUI_RO, luat: { beChuoiVon: false },
    }), 3)).toBeNull();
  });

  it('⭐ sổ KHỐNG không tính vào phe — khống là cược NGƯỢC phe đó', () => {
    const st = dungSt({ o: O_GIAM, mt: 'dat', viThe: [{}, {}, {}, {}] });
    const gheKhong = st.ghe.map((g, i) => (i === 0
      ? { ...g, vi_the_khong: { btc: 9000 } } : g));
    expect(beChuoiCuaLobby({ ...st, ghe: gheKhong } as TrangThaiTran, 3)).toBeNull();
  });
});

describe('III. Máy áp — seeded, nhường, giữ lời hứa', () => {
  /** Tìm một seed NỔ và một seed IM trong cùng cảnh — chống phép-đo-một-mặt. */
  const timHaiSeed = () => {
    let no: TrangThaiTran | null = null;
    let im: TrangThaiTran | null = null;
    for (let seed = 1; seed <= 80 && (!no || !im); seed += 1) {
      const st = dungSt({ o: O_GIAM, mt: 'dat', viThe: VI_DON_RUI_RO, seed });
      const sau = apBeChuoiVon(st, 3);
      if (sau !== st) no = st; else im = st;
    }
    return { no, im };
  };

  it('⭐⭐ có seed nổ (ô pha bị bẻ + ghi log), có seed im — nghiêng xác suất, không định đoạt', () => {
    const { no, im } = timHaiSeed();
    expect(no, 'không seed nào nổ trong 80 — máy chết').not.toBeNull();
    expect(im, 'mọi seed đều nổ — thành định đoạt, phạm §3 addendum').not.toBeNull();
    const sau = apBeChuoiVon(no!, 3);
    expect((sau.map.o[2] as { giai_doan: string }).giai_doan).toBe('tang');
    expect(sau.be_chuoi).toEqual([{ vong: 3, tu: 'di_ngang', den: 'tang', huong: 'len' }]);
    // immutable — st gốc không bị sờ.
    expect((no!.map.o[2] as { giai_doan: string }).giai_doan).toBe('di_ngang');
  });

  it('⭐ NHƯỜNG phản thân: vòng đã có cú thay ô D4 ⇒ không thay lần hai', () => {
    const { no } = timHaiSeed();
    const daThay = {
      ...no!, phan_than: [{ vong: 3, tu: 'di_ngang', den: 'tang', vi: 'don' as const }],
    };
    expect(apBeChuoiVon(daThay, 3)).toBe(daThay);
  });

  it('⭐ không bẻ ô đang bị telegraph HỨA (sau sự kiện thật); tin giả thì bẻ được', () => {
    const oTg = [gd('giam'), gd('giam'), sk('ha_lai_suat'), gd('di_ngang')];
    for (let seed = 1; seed <= 80; seed += 1) {
      const st = dungSt({ o: oTg, mt: 'dat', viThe: VI_DON_RUI_RO, seed });
      expect(apBeChuoiVon(st, 4), `seed ${seed} bẻ ô đã hứa telegraph`).toBe(st);
    }
    // cùng cảnh, tin GIẢ ⇒ tồn tại seed bẻ được (tin bịa không có lời hứa).
    const oGia = [gd('giam'), gd('giam'), sk('ha_lai_suat', true), gd('di_ngang')];
    let co = false;
    for (let seed = 1; seed <= 80 && !co; seed += 1) {
      const st = dungSt({ o: oGia, mt: 'dat', viThe: VI_DON_RUI_RO, seed });
      if (apBeChuoiVon(st, 4) !== st) co = true;
    }
    expect(co).toBe(true);
  });

  it('chỉ bẻ Ô PHA — ô sự kiện sắp lật thì đứng yên', () => {
    const oSk = [gd('giam'), gd('giam'), sk('lam_phat'), gd('tang')];
    for (let seed = 1; seed <= 40; seed += 1) {
      const st = dungSt({ o: oSk, mt: 'dat', viThe: VI_DON_RUI_RO, seed });
      expect(apBeChuoiVon(st, 3)).toBe(st);
    }
  });
});

describe('IV. Cá mập — cộng nhẹ, tính bằng vốn', () => {
  it('⭐ cá mập tập trung cùng phe ⇒ +CA_MAP_THEM_BP; không tập trung ⇒ nền', () => {
    const stTapTrung = dungSt({
      o: O_GIAM, mt: 'dat',
      viThe: [{ btc: 9000 }, { vang: 100 }, { vang: 100 }, { vang: 100 }],
      vai: ['ca_map', undefined, undefined, undefined],
    });
    expect(xsBeChuoiCua(stTapTrung, 'len'))
      .toBe(BE_CHUOI_VON.XAC_SUAT_BP + BE_CHUOI_VON.CA_MAP_THEM_BP);
    const stLoang = dungSt({
      o: O_GIAM, mt: 'dat',
      viThe: [{ btc: 100, vang: 9000 }, { btc: 9000 }, {}, {}],
      vai: ['ca_map', undefined, undefined, undefined],
    });
    expect(xsBeChuoiCua(stLoang, 'len')).toBe(BE_CHUOI_VON.XAC_SUAT_BP);
  });
});
