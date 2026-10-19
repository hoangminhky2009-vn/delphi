import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  chamNhiemVu, chonKyNgoBot, dacQuyenKyNgo, doiPhaCuaMap, dungHuong,
  ongKinhVong, phieuConLai, soVoiCho, themGiayKyNgo, tienTrinhKyNgo,
  type VongKyNgo,
} from '../server/holdem/ky_ngo.js';
import { chuongHoi } from '../server/holdem/chuong_hoi.js';
import {
  KY_NGO, NHIEM_VU_KY_NGO, boNhiemVuMoi, boNhiemVuTheoHoi, laVongKyNgo,
} from '../config/holdem.js';

/*
 * KỲ NGỘ — LƯỚI CANH (D85/D86 §1, doc 06 §1.4).
 *
 * Vector chép tay theo nếp A5.2: chỗ nào quyết định "xong hay không xong" thì
 * phải chứng minh bằng số tính tay, không phải bằng ảnh chụp hành vi hiện tại.
 *
 * ⚠⚠ Bài quan trọng nhất KHÔNG phải bài đếm điểm — mà là bài canh LẰN RANH A1:
 * không nhiệm vụ nào được thưởng MỨC PHƠI NHIỄM. Đó là thứ mà nếu trôi thì
 * `events` đo sự vâng lời thay vì khẩu vị rủi ro, và append-only nên không gắn
 * nhãn lại được (A3.3).
 */

const v = (
  viThe: Record<string, number>, loiSuatBp: Record<string, number>,
  brier: number | null = null, doiPha = false,
): VongKyNgo => ({ viThe, loiSuatBp, brier, doiPha });

describe('đúng hướng — trọng số VỐN, không đếm đầu mã', () => {
  it('mua mã lên = đúng; mua mã xuống = sai', () => {
    expect(dungHuong(v({ btc: 100 }, { btc: 500 }))).toBe(true);
    expect(dungHuong(v({ btc: 100 }, { btc: -500 }))).toBe(false);
  });

  it('bán khống mã xuống = ĐÚNG (dấu vị thế khớp dấu lợi suất)', () => {
    expect(dungHuong(v({ btc: -100 }, { btc: -500 }))).toBe(true);
    expect(dungHuong(v({ btc: -100 }, { btc: 500 }))).toBe(false);
  });

  it('⭐ TRỌNG SỐ VỐN: 1 mã lẻ đúng + 1 mã nặng sai ⇒ VÒNG SAI', () => {
    // Đếm đầu mã thì 1-1 hoà; trọng số vốn thì 90 sai / 10 đúng ⇒ sai.
    expect(dungHuong(v({ a: 10, b: 90 }, { a: 500, b: -500 }))).toBe(false);
    // Và ngược lại: mã nặng đúng thì vòng đúng dù mã lẻ sai.
    expect(dungHuong(v({ a: 90, b: 10 }, { a: 500, b: -500 }))).toBe(true);
  });

  it('đúng ĐÚNG 50% vốn ⇒ KHÔNG đạt (luật là > 50%)', () => {
    expect(dungHuong(v({ a: 50, b: 50 }, { a: 500, b: -500 }))).toBe(false);
  });

  it('⭐ toàn tiền mặt ⇒ null, KHÔNG phải false (đứng ngoài ≠ dự báo sai — D67)', () => {
    expect(dungHuong(v({}, { btc: 500 }))).toBeNull();
    expect(dungHuong(v({ btc: 0 }, { btc: 500 }))).toBeNull();
  });

  it('mã có r = 0 bị bỏ ra, không tính về phía nào', () => {
    expect(dungHuong(v({ a: 100, b: 100 }, { a: 0, b: 500 }))).toBe(true);
    expect(dungHuong(v({ a: 100 }, { a: 0 }))).toBeNull();
  });
});

describe('KẺ VƯỢT SÓNG (D88) — phần chợ CHỌN so phần chợ LOẠI, trung bình ĐỀU', () => {
  it('chọn mã tốt, loại mã tệ ⇒ thắng; chọn tệ loại tốt ⇒ thua', () => {
    expect(soVoiCho(v({ a: 100 }, { a: 900, b: -300 })))
      .toEqual({ thang: true, chenh_bp: 1200 });
    expect(soVoiCho(v({ a: 100 }, { a: 100, b: 900 })))
      .toEqual({ thang: false, chenh_bp: -800 });
  });

  it('⭐⭐ DÀN ĐỀU MÀ ĐỌC ĐÚNG VẪN ĐẠT — lằn ranh §1.2 mà bản cũ phạm', () => {
    /*
     * Bản cũ so với trung bình MỌI mã: dàn đều = chỉ số ⇒ VĨNH VIỄN không
     * đạt — gradient thưởng chỉ về phía ít dàn đều, tức chạm trục "đa dạng
     * hoá" §1.2 cấm. Bản mới: dàn đều 5/6 mã, loại đúng mã tệ nhất ⇒ ĐẠT.
     */
    const r = soVoiCho(v(
      { a: 100, b: 100, c: 100, d: 100, e: 100 },
      { a: 500, b: 300, c: 100, d: -100, e: -200, f: -900 }));
    expect(r?.thang).toBe(true);
    // giữ = (500+300+100-100-200)/5 = 120 · loại = -900 ⇒ chênh 1020.
    expect(r?.chenh_bp).toBe(1020);
  });

  it('⭐ CỠ VỊTHẾ KHÔNG ĐỔI KẾT QUẢ — trục tập trung không bị chạm', () => {
    const deu = soVoiCho(v({ a: 100, b: 100 }, { a: 500, b: -100, c: -400 }));
    const lech = soVoiCho(v({ a: 1900, b: 10 }, { a: 500, b: -100, c: -400 }));
    expect(deu).toEqual(lech);
  });

  it('bán khống mã rơi = cú CHỌN đúng (chiều vị thế, không cỡ)', () => {
    // giữ (khống a): -(-800) = 800 · loại b: 0 ⇒ thắng, chênh 800.
    expect(soVoiCho(v({ a: -100 }, { a: -800, b: 0 })))
      .toEqual({ thang: true, chenh_bp: 800 });
  });

  it('toàn tiền mặt ⇒ null; ÔM CẢ BÀN cũng null (chọn tất cả = không chọn)', () => {
    expect(soVoiCho(v({}, { a: 500 }))).toBeNull();
    expect(soVoiCho(v({ a: 100, b: 100 }, { a: 500, b: -100 }))).toBeNull();
  });
});

describe('chấm nhiệm vụ', () => {
  const coViThe = (n: number, ok: boolean): VongKyNgo[] =>
    Array.from({ length: n }, () => v({ a: 100 }, { a: ok ? 500 : -500 }, 0.2, false));

  it('LA BÀN: 6 vòng đúng / runway 6 ⇒ cần ⌈60%×6⌉ = 4 ⇒ XONG', () => {
    const t = chamNhiemVu('la_ban', coViThe(6, true), 6);
    expect(t.can).toBe(4);
    expect(t.dat).toBe(6);
    expect(t.xong).toBe(true);
  });

  it('LA BÀN: đúng 3/6 ⇒ dưới ngưỡng 4 ⇒ CHƯA xong', () => {
    const vongs = [...coViThe(3, true), ...coViThe(3, false)];
    const t = chamNhiemVu('la_ban', vongs, 6);
    expect(t.dat).toBe(3);
    expect(t.xong).toBe(false);
  });

  it('⭐⭐ CHỐNG LÁCH: nằm im rồi vào ĐÚNG HAI vòng đổi pha ⇒ KHÔNG xong', () => {
    /*
     * ⚠ BÀI NÀY TỪNG XANH VÌ LÝ DO KHÁC (sửa 15/08). Bản đầu dùng LA BÀN, và
     * tiêm lỗi ngược (bỏ hẳn vế chống lách) KHÔNG làm nó đỏ — tức nó chưa bao
     * giờ canh cái nó mang tên. Truy ra: với LA BÀN/TAY CÂN/KẺ VƯỢT SÓNG ngưỡng
     * là TỶ LỆ (60%/60%/50% runway) mà `dat ≤ vongCoViThe` luôn đúng, nên
     * `dat ≥ can` đã kéo theo `vongCoViThe ≥ 50% runway` — vế chống lách THỪA.
     *
     * Nó chỉ CHỊU LỰC ở KẺ BẮT NHỊP, nơi ngưỡng là số CỐ ĐỊNH (2 vòng đổi pha)
     * không neo vào runway: 2 vòng đúng + nằm im phần còn lại là 2/2 và "xong"
     * nếu không có vế này. Đó chính là chiến lược trội phải chặn.
     */
    const vongs = [
      v({ a: 100 }, { a: 500 }, 0.2, true),
      v({ a: 100 }, { a: 500 }, 0.2, true),
      ...Array.from({ length: 4 }, () => v({}, { a: 500 })),
    ];
    const t = chamNhiemVu('bat_nhip', vongs, 6);
    expect(t.dat).toBe(2);
    expect(t.can).toBe(2);                 // ngưỡng nội dung ĐÃ đạt
    expect(t.vongCoViThe).toBe(2);
    expect(t.canCoViThe).toBe(3);          // ⌈50% × 6⌉
    expect(t.xong, 'nằm im rồi vào hai vòng ăn chắc vẫn xong ⇒ chiến lược trội')
      .toBe(false);
  });

  it('KẺ BẮT NHỊP có mặt đủ ⇒ xong (vế chống lách không chặn người chơi thật)', () => {
    const vongs = [
      v({ a: 100 }, { a: 500 }, 0.2, true),
      v({ a: 100 }, { a: 500 }, 0.2, true),
      ...coViThe(2, false),                 // có mặt, đọc sai — vẫn tính là CÓ MẶT
      ...Array.from({ length: 2 }, () => v({}, { a: 500 })),
    ];
    expect(chamNhiemVu('bat_nhip', vongs, 6).xong).toBe(true);
  });

  it('KẺ BẮT NHỊP chỉ tính vòng ĐỔI PHA', () => {
    const vongs = [
      v({ a: 100 }, { a: 500 }, 0.2, true),
      v({ a: 100 }, { a: 500 }, 0.2, true),
      ...coViThe(4, true),                  // đúng nhưng KHÔNG đổi pha
    ];
    const t = chamNhiemVu('bat_nhip', vongs, 6);
    expect(t.can).toBe(KY_NGO.BAT_NHIP_SO_VONG);
    expect(t.dat).toBe(2);
    expect(t.xong).toBe(true);
  });

  it('KẺ BẮT NHỊP: đổi pha mà đọc SAI thì không tính', () => {
    const vongs = [
      v({ a: 100 }, { a: -500 }, 0.2, true),
      v({ a: 100 }, { a: -500 }, 0.2, true),
      ...coViThe(4, true),
    ];
    expect(chamNhiemVu('bat_nhip', vongs, 6).dat).toBe(0);
  });

  it('TAY CÂN: Brier THẤP là tốt, và vòng null không tính', () => {
    const tot = Array.from({ length: 6 }, () => v({ a: 100 }, { a: 500 }, 0.1));
    expect(chamNhiemVu('tay_can', tot, 6).xong).toBe(true);
    const te = Array.from({ length: 6 }, () => v({ a: 100 }, { a: 500 }, 1.5));
    expect(chamNhiemVu('tay_can', te, 6).dat).toBe(0);
  });
});

describe('bộ mời + vị trí kỳ ngộ', () => {
  it('map 8 KHÔNG có kỳ ngộ (mẫu đối chứng doc 06 §4)', () => {
    for (let r = 1; r <= 8; r += 1) expect(laVongKyNgo(r, 8)).toBe(false);
  });

  it('map 12 → vòng 7 · map 16 → vòng 6 và 12', () => {
    expect(laVongKyNgo(7, 12)).toBe(true);
    expect(laVongKyNgo(6, 12)).toBe(false);
    expect(laVongKyNgo(6, 16)).toBe(true);
    expect(laVongKyNgo(12, 16)).toBe(true);
    expect(laVongKyNgo(7, 16)).toBe(false);
  });

  it('mời ĐÚNG 3 trong 4, không trùng, TẤT ĐỊNH theo (seed, vòng)', () => {
    const a = boNhiemVuMoi(12345, 7);
    expect(a).toHaveLength(KY_NGO.SO_MOI);
    expect(new Set(a).size).toBe(KY_NGO.SO_MOI);
    expect(boNhiemVuMoi(12345, 7)).toEqual(a);   // gọi lại ra y hệt (replay)
  });

  it('⭐ xoay vòng: MỌI nhiệm vụ đều có lúc vắng mặt (lộ lựa chọn thứ hai)', () => {
    const vang = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const bo = new Set(boNhiemVuMoi(seed, 7));
      for (const nv of NHIEM_VU_KY_NGO) if (!bo.has(nv.id)) vang.add(nv.id);
    }
    expect(vang.size, 'có nhiệm vụ không bao giờ vắng ⇒ không xoay thật')
      .toBe(NHIEM_VU_KY_NGO.length);
  });
});

describe('⚠⚠ LẰN RANH A1 — không nhiệm vụ nào thưởng MỨC PHƠI NHIỄM', () => {
  const nguon = readFileSync(resolve(process.cwd(), 'server/holdem/ky_ngo.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('code chấm điểm KHÔNG đọc số mã đang giữ (đa dạng hoá) hay tỷ lệ tiền mặt', () => {
    for (const cam of ['tienMat', 'tien_mat', 'soMa', 'so_ma', 'daDang', 'da_dang']) {
      expect(nguon.includes(cam), `chấm điểm đọc "${cam}" — đang kê đơn tư thế rủi ro`)
        .toBe(false);
    }
  });

  it('⭐ NHÂN ĐÔI mọi vị thế KHÔNG đổi kết quả chấm — chỉ HƯỚNG mới tính', () => {
    // Nếu chấm điểm lén thưởng "phơi ra nhiều", vòng nặng gấp đôi sẽ khác điểm.
    const nhe = [v({ a: 10, b: 10 }, { a: 500, b: -500 }, 0.2, true)];
    const nang = [v({ a: 1000, b: 1000 }, { a: 500, b: -500 }, 0.2, true)];
    for (const id of ['la_ban', 've_song', 'bat_nhip', 'tay_can'] as const) {
      expect(chamNhiemVu(id, nhe, 4), `${id} đổi kết quả theo CỠ vị thế`)
        .toEqual(chamNhiemVu(id, nang, 4));
    }
  });

  it('mô tả nhiệm vụ MÔ TẢ, không kê đơn (A10)', () => {
    for (const nv of NHIEM_VU_KY_NGO) {
      for (const c of ['hãy ', 'nên ', 'đừng ', 'giữ tiền mặt', 'đa dạng hoá']) {
        expect(nv.mo_ta.toLowerCase().includes(c), `${nv.id}: "${c}"`).toBe(false);
      }
    }
  });

  it('mỗi nhiệm vụ một đặc quyền RIÊNG — không cái nào trùng nhau', () => {
    const dq = NHIEM_VU_KY_NGO.map((x) => x.dac_quyen);
    expect(new Set(dq).size).toBe(dq.length);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * TIẾN TRÌNH + ĐẶC QUYỀN — lớp NỐI DÂY, vẫn thuần nên vẫn chép tay được số
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ô đổi pha', () => {
  it('ô i đổi pha ⟺ pha SAU nó khác pha TRƯỚC nó', () => {
    //  ô:        1      2      3      4
    //  pha nền:  tang   tang   giam   giam
    //  ⇒ ô 2 là ô làm đổi pha (tang → giam). Ô 4 KHÔNG BIẾT được (hết map).
    expect(doiPhaCuaMap(['tang', 'tang', 'giam', 'giam'], 4))
      .toEqual([false, true, false, false]);
  });

  it('map cũ không có `trang_thai` ⇒ toàn false, không đoán', () => {
    expect(doiPhaCuaMap(undefined, 3)).toEqual([false, false, false]);
  });
});

describe('tiến trình kỳ ngộ', () => {
  const soLieu = (m: Record<number, VongKyNgo>) =>
    new Map(Object.entries(m).map(([k, x]) => [Number(k), x] as const));

  it('chưa chọn ⇒ tiến độ null (UI vẽ lời mời, không vẽ "0/5")', () => {
    const l = tienTrinhKyNgo(1, 12, new Map(), new Map());
    expect(l).toHaveLength(1);
    expect(l[0]!.vong).toBe(7);
    expect(l[0]!.chon).toBeNull();
    expect(l[0]!.tien_do).toBeNull();
    expect(l[0]!.moi).toHaveLength(KY_NGO.SO_MOI);
  });

  it('⭐ chọn một món KHÔNG được mời ⇒ coi như chưa chọn (log cũ sống lâu hơn luật)', () => {
    const moi = boNhiemVuMoi(1, 7);
    const ngoai = NHIEM_VU_KY_NGO.map((x) => x.id).find((id) => !moi.includes(id))!;
    const l = tienTrinhKyNgo(1, 12, new Map([[7, ngoai]]), new Map());
    expect(l[0]!.chon).toBeNull();
  });

  it('map 8 KHÔNG có kỳ ngộ nào — mẫu đối chứng', () => {
    expect(tienTrinhKyNgo(1, 8, new Map(), new Map())).toEqual([]);
  });

  it('⭐ `xong_o_vong` là vòng ĐẦU TIÊN đạt, và không tụt lại sau đó', () => {
    const moi = boNhiemVuMoi(7, 12);
    // Chọn LA BÀN nếu được mời, không thì bỏ bài này (bộ mời tất định theo seed).
    if (!moi.includes('la_ban')) return;
    // runway = 12 − 7 + 1 = 6 ⇒ cần ceil(6×0,6) = 4 vòng đúng hướng,
    // và ≥ ceil(6×0,5) = 3 vòng CÓ vị thế. Sáu vòng đúng liên tiếp ⇒ xong ở vòng 10.
    const dung = v({ a: 100 }, { a: 500 });
    const s = soLieu({ 7: dung, 8: dung, 9: dung, 10: dung, 11: dung, 12: dung });
    const l = tienTrinhKyNgo(7, 12, new Map([[7, 'la_ban']]), s);
    expect(l[0]!.xong_o_vong).toBe(10);
    expect(l[0]!.tien_do!.xong).toBe(true);
  });
});

describe('đặc quyền — mốc hiệu lực và phiếu', () => {
  const lan = (xongO: number | null) => [{
    vong: 7, moi: ['tay_can'] as const, hoi: null, chon: 'tay_can' as const,
    tien_do: null, xong_o_vong: xongO,
  }];

  it('⭐ hiệu lực từ vòng KẾ TIẾP — kết quả vòng V chỉ biết SAU khi V chốt', () => {
    expect(dacQuyenKyNgo(lan(9)).get('phieu_mo_bang')).toBe(10);
    expect(dacQuyenKyNgo(lan(null)).size).toBe(0);
  });

  it('THẺ GIỜ cộng giây từ đúng mốc, trước mốc là 0', () => {
    const dq = new Map([['the_gio' as const, 9]]);
    expect(themGiayKyNgo(dq, 8)).toBe(0);
    expect(themGiayKyNgo(dq, 9)).toBe(KY_NGO.THE_GIO_THEM_S);
    expect(themGiayKyNgo(new Map(), 9)).toBe(0);
  });

  it('PHIẾU MỞ BẢNG tiêu theo VÒNG CÓ MỞ, cạn thì thôi, không âm', () => {
    const mo = new Map([[9, 1], [10, 1], [11, 1]]);
    expect(phieuConLai(9, mo, 9)).toBe(KY_NGO.PHIEU_MO_BANG_SO);   // chưa tiêu
    expect(phieuConLai(9, mo, 10)).toBe(KY_NGO.PHIEU_MO_BANG_SO - 1);
    expect(phieuConLai(9, mo, 11)).toBe(KY_NGO.PHIEU_MO_BANG_SO - 2);
    expect(phieuConLai(9, mo, 12)).toBe(0);                        // cạn, không âm
    // Vòng TRƯỚC mốc hiệu lực không tiêu phiếu.
    expect(phieuConLai(11, mo, 12)).toBe(KY_NGO.PHIEU_MO_BANG_SO - 1);
    // Không có đặc quyền ⇒ 0 phiếu, không phải `PHIEU_MO_BANG_SO`.
    expect(phieuConLai(undefined, mo, 12)).toBe(0);
  });
});

describe('bot chọn con đường — cho icon có gì để hiện', () => {
  it('luôn trả một món TRONG bộ được mời, và tất định theo cùng phép rút', () => {
    const moi = boNhiemVuMoi(3, 7);
    const a = chonKyNgoBot(moi, () => 1);
    expect(moi).toContain(a);
    expect(chonKyNgoBot(moi, () => 1)).toBe(a);
    expect(chonKyNgoBot([], () => 0)).toBeNull();
  });
});

describe('phiếu mở bảng — HAI con số, hai câu hỏi', () => {
  it('⭐⭐ số QUYẾT ĐỊNH đếm tới ĐẦU vòng, không trừ lần mở đang treo', () => {
    /*
     * Đây là chỗ dễ "sửa nhầm cho gọn" nhất của cả cụm: gộp hai con số làm một
     * thì ca "còn ĐÚNG 1 phiếu, mở bảng rồi nâng hạng trong CÙNG vòng" ra
     * endpoint thu 30 chênh lệch trong khi replay miễn trọn vòng — màn báo một
     * đằng, engine trừ một nẻo (D67).
     *
     * `phieuConLai` là hàm QUYẾT ĐỊNH: nó chỉ đếm các vòng ĐÃ CHỐT (< denVong).
     * Lần mở của chính `denVong` KHÔNG được nằm trong `soLanTheoVong`.
     */
    const mo = new Map([[9, 1]]);           // đã mở ở vòng 9
    // Đứng ở vòng 10: vòng 9 đã tiêu 1 phiếu ⇒ còn PHIEU_MO_BANG_SO − 1.
    expect(phieuConLai(9, mo, 10)).toBe(KY_NGO.PHIEU_MO_BANG_SO - 1);
    // Đứng ở CHÍNH vòng 9 (lần mở còn treo): số quyết định vẫn ĐẦY — nếu không
    // thì người còn đúng 1 phiếu sẽ bị thu tiền ở nấc nâng hạng cùng vòng.
    expect(phieuConLai(9, mo, 9)).toBe(KY_NGO.PHIEU_MO_BANG_SO);
  });
});


/* ══════════════════════════════════════════════════════════════════════
 * D88 — ỐNG KÍNH + MỜI THEO HỒI
 * ══════════════════════════════════════════════════════════════════════ */

describe('ống kính con đường — hồi cố, không một bit mới', () => {
  it('bốn con đường ra bốn loại dòng, số khớp hàm chấm', () => {
    const x = v({ a: 90, b: 10 }, { a: 500, b: -500 }, 0.32, true);
    expect(ongKinhVong('la_ban', x))
      .toEqual({ loai: 'la_ban', ty_le_dung_bp: 9000 });
    expect(ongKinhVong('tay_can', x)).toEqual({ loai: 'tay_can', brier: 0.32 });
    expect(ongKinhVong('bat_nhip', x)).toEqual({ loai: 'bat_nhip', doi_pha: true });
    const vs = ongKinhVong('ve_song', v({ a: 100 }, { a: 900, b: -300 }));
    expect(vs).toEqual({ loai: 've_song', chenh_bp: 1200 });
  });

  it('⭐ vòng đứng ngoài ⇒ số là null — client vẽ —, KHÔNG vẽ số âm (chốt §1.2)', () => {
    const nghi = v({}, { a: 500 }, null, false);
    expect(ongKinhVong('la_ban', nghi))
      .toEqual({ loai: 'la_ban', ty_le_dung_bp: null });
    expect(ongKinhVong('tay_can', nghi)).toEqual({ loai: 'tay_can', brier: null });
    expect(ongKinhVong('ve_song', nghi)).toEqual({ loai: 've_song', chenh_bp: null });
  });
});

describe('mời theo hồi (D88 §11.3)', () => {
  it('hồi có trong bảng ⇒ loại ĐÚNG món đó, vẫn đủ 3/4', () => {
    for (const [hoi, loai] of Object.entries(KY_NGO.LOAI_THEO_HOI)) {
      const moi = boNhiemVuTheoHoi(1, 7, hoi);
      expect(moi).toHaveLength(KY_NGO.SO_MOI);
      expect(moi).not.toContain(loai);
    }
  });

  it('hồi lạ / null ⇒ rơi về phép xoay cũ — không nổ, không bịa', () => {
    expect(boNhiemVuTheoHoi(9, 7, 'giu_nhip')).toEqual(boNhiemVuMoi(9, 7));
    expect(boNhiemVuTheoHoi(9, 7, null)).toEqual(boNhiemVuMoi(9, 7));
  });

  it('mỗi nhiệm vụ bị loại ở TỐI ĐA một hồi — không ai bị bỏ đói lời mời', () => {
    const loai = Object.values(KY_NGO.LOAI_THEO_HOI);
    expect(new Set(loai).size).toBe(loai.length);
  });

  it('tienTrinhKyNgo dùng bộ mời được cấp + mang hồi ra ngoài', () => {
    const moiHoi = new Map([[7, { moi: ['la_ban', 'tay_can', 've_song'] as const, hoi: 'bong_bong' }]]);
    const l = tienTrinhKyNgo(1, 12, new Map([[7, 'la_ban']]), new Map(), moiHoi);
    expect(l[0]!.hoi).toBe('bong_bong');
    expect(l[0]!.moi).toEqual(['la_ban', 'tay_can', 've_song']);
    expect(l[0]!.chon).toBe('la_ban');
    // Chọn món ngoài bộ được cấp ⇒ coi như chưa chọn — lọc theo bộ THẬT.
    const moiHoi2 = new Map([[7, { moi: ['tay_can', 've_song', 'bat_nhip'] as const, hoi: 'bong_bong' }]]);
    const l2 = tienTrinhKyNgo(1, 12, new Map([[7, 'la_ban']]), new Map(), moiHoi2);
    expect(l2[0]!.chon).toBeNull();
  });
});

describe('⭐⭐ GOLDEN — luật hồi nằm trên ĐƯỜNG REPLAY, đổi là phải qua cổng', () => {
  /*
   * Từ D88, bộ mời kỳ ngộ = hàm của `chuongHoi` ⇒ đổi bất kỳ ngưỡng/nhánh
   * nào của luật hồi là đổi bộ mời của MỌI trận v32 đã lưu — y như đổi
   * engine. Golden vector khoá để cú sửa "chỉ là hiển thị" không đi lọt:
   * bài đỏ ở đây nghĩa là PHẢI mở cổng `balance_version` mới, không phải
   * sửa cho bài xanh.
   */
  const gd = (giai_doan: string) => ({ kind: 'giai_doan' as const, giai_doan });
  const sk = (su_kien: string, bao_truoc: string) =>
    ({ kind: 'su_kien' as const, su_kien, bao_truoc });

  it('golden: bốn cửa ra bốn hồi đúng tên', () => {
    expect(chuongHoi([gd('tang'), gd('giam')], sk('thien_nga_den', 'bien_dong'),
      null, 'trung_tinh').id).toBe('song_gio');
    expect(chuongHoi([gd('tang'), gd('tang')], gd('tang'),
      { huong: 1, dai: 3 }, 'trung_tinh').id).toBe('bong_bong');
    expect(chuongHoi([gd('giam'), sk('hack_san', 'giam')], gd('phuc_hoi'),
      null, 'trung_tinh').id).toBe('gay_dung');
    expect(chuongHoi([gd('di_ngang'), gd('tang')], gd('di_ngang'),
      null, 're').id).toBe('tien_re');
    /*
     * ⭐ Golden PHÂN BIỆT NGƯỠNG: một ô bão LẺ giữa dải xanh KHÔNG được
     * thành SÓNG GIÓ (ngưỡng ≥2/3). Tiêm lỗi ngược đợt đầu lộ ra ba golden
     * kia đều không chạm nhánh này — hạ ngưỡng xuống 1 mà cả bộ vẫn xanh,
     * tức "khoá luật hồi" chỉ khoá một nửa. Bài này là nửa còn lại.
     */
    expect(chuongHoi([gd('tang'), gd('tang')], sk('hack_san', 'giam'),
      null, 'trung_tinh').id).toBe('giu_nhip');
  });

  it('golden: bộ mời theo hồi trên seed cố định', () => {
    expect(boNhiemVuTheoHoi(20260816, 7, 'bong_bong'))
      .toEqual(['tay_can', 've_song', 'bat_nhip']);
    expect(boNhiemVuTheoHoi(20260816, 7, 'tien_re'))
      .toEqual(['la_ban', 'tay_can', 've_song']);
    expect(boNhiemVuTheoHoi(20260816, 7, 'gay_dung'))
      .toEqual(['la_ban', 'tay_can', 'bat_nhip']);
    /*
     * `song_gio` CỐ Ý rơi về phép xoay — phép đo bác entry cố định (hồi
     * phổ biến nhất tại kỳ ngộ, 25–46%, gắn món loại là bỏ đói món đó
     * — xem docstring LOAI_THEO_HOI). Ai thêm entry lại cho song_gio thì bài
     * này đỏ, và việc đúng là chạy lại `scripts/quet_hoi_ky_ngo.ts` trước.
     */
    expect(boNhiemVuTheoHoi(20260816, 7, 'song_gio'))
      .toEqual(boNhiemVuMoi(20260816, 7));
  });
});
