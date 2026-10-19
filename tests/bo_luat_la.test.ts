/**
 * D399 — BỘ LUẬT TỪNG LÁ (v54, cổng `luatLa`). Founder 24/09: *"mỗi thẻ phải có 1 rule để không bị quá vô lý với
 * chuỗi trước/ sau"* — duyệt 12 luật đối chiếu lịch sử (bỏ R10, R11 chỉ khủng hoảng tài chính, R5·R9·R12 nới lý do).
 *
 * Luật được viết LẠI trong bài (vòng lặp riêng, không gọi máy) — bài không chấm chính máy bằng máy. Chỉ SỐ (cửa sổ,
 * danh sách lá) đọc từ `config/luat_la.ts`.
 * ⚠ MỌI MỤC CÓ VẾ NGƯỢC: cùng v54, cùng seed, TẮT cổng — phải thấy vi phạm (lớp "bài canh rỗng" D262 · D269 · D272).
 */
import { describe, expect, it } from 'vitest';
import { TINH_CHAT_NEN, type GiaiDoanId, type SuKienId } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { LUAT_LA, type BangChung } from '../config/luat_la.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { giaiMat, matHopLe, tinHopLe } from '../server/holdem/luat_la.js';
import { sinhMap, type HoldemMap, type OThiTruong, type TrangThaiO } from '../server/holdem/map.js';

const V54 = 'balance-v54-ngare';
const HAT = (s: number): number => s * 7919 + 13;
const N = 2000;
const ban = (bat: boolean, n = N): HoldemMap[] => {
  const tc = tuyChonSinhMap({ ...luatCua(V54), luatLa: bat });
  return Array.from({ length: n }, (_, s) => sinhMap(HAT(s), 16, tc));
};
const BAT = ban(true);
const TAT = ban(false);

// ─── đọc chuỗi (viết lại) ────────────────────────────────────────────────────────────────────
const that = (t: OThiTruong | undefined, ds: readonly BangChung[]): boolean =>
  t !== undefined && t.kind === 'su_kien' && !t.la_tin_gia
  && (ds.includes(t.su_kien) || (ds.includes('hoang_loan') && TINH_CHAT_NEN[t.su_kien] === 'hoang_loan'));
const pha = (t: OThiTruong | undefined, ds: readonly GiaiDoanId[]): boolean =>
  t !== undefined && t.kind === 'giai_doan' && ds.includes(t.giai_doan);
const trongO = (o: readonly OThiTruong[], i: number, n: number, ds: readonly BangChung[]): boolean =>
  o.slice(Math.max(0, i - n), i).some((t) => that(t, ds));
function tuMoc(o: readonly OThiTruong[], i: number, moc: readonly GiaiDoanId[]): readonly OThiTruong[] | null {
  for (let k = i - 1; k >= 0; k -= 1) if (pha(o[k], moc)) return o.slice(k + 1, i);
  return null;
}
const gd = (g: GiaiDoanId): OThiTruong => ({ kind: 'giai_doan', giai_doan: g });
const tin = (id: SuKienId, gia = false): OThiTruong => ({
  kind: 'su_kien', su_kien: id, la_tin_gia: gia, boi_canh: 'don_doc', bao_truoc: 'tang',
});

/** Đếm vi phạm luật lá PHA trên một lô bàn. */
function viPhamPha(bs: readonly HoldemMap[]): Record<string, number> {
  const d = { khongDay: 0, khongNhiet: 0, nongGiuaSuy: 0, tangSauKhungHoang: 0 };
  for (const m of bs) {
    m.o.forEach((x, i) => {
      if (x.kind !== 'giai_doan') return;
      const mua = m.trang_thai![i]!.mua;
      if (x.giai_doan === 'phuc_hoi') {
        const sau = tuMoc(m.o, i, ['tang', 'bien_dong']);
        if (sau !== null && !sau.some((t) => pha(t, ['giam']) || that(t, LUAT_LA.DAY.TIN))) d.khongDay += 1;
      }
      if (x.giai_doan === 'bien_dong') {
        const sau = tuMoc(m.o, i, ['giam', 'phuc_hoi']);
        const so = sau === null ? Infinity : sau.filter((t) => pha(t, ['tang', 'bien_dong'])).length;
        const N_ = LUAT_LA.NHIET;
        if (so < (trongO(m.o, i, N_.TRONG_O, N_.TIN) ? N_.SO_LA_KHI_CO_TIN : N_.SO_LA)) d.khongNhiet += 1;
        if (mua === 'giam' || mua === 'di_ngang') d.nongGiuaSuy += 1;
      }
      if ((x.giai_doan === 'tang' || x.giai_doan === 'bien_dong') && that(m.o[i - 1], LUAT_LA.KHUNG_HOANG_TAI_CHINH)) {
        d.tangSauKhungHoang += 1;
      }
    });
  }
  return d;
}

/** Đếm vi phạm luật lá TIN (bỏ ô kỳ họp — đi đường sai lầm chính sách) + lãi suất đảo chiều vô cớ. */
function viPhamTin(bs: readonly HoldemMap[]) {
  const d = { hack_san: 0, pha_san: 0, bong_bong: 0, lam_phat: 0, tang_lai_suat: 0, ha_lai_suat: 0, dao_chieu: 0 };
  const T = LUAT_LA.TIN as Record<string, { mua: readonly GiaiDoanId[]; can: readonly BangChung[]; trong_o: number }>;
  for (const m of bs) {
    m.o.forEach((x, i) => {
      if (x.kind !== 'su_kien' || m.trang_thai![i]!.o_lich) return;
      const luat = T[x.su_kien];
      if (luat && luat.mua.includes(m.trang_thai![i]!.mua!) && !trongO(m.o, i, luat.trong_o, luat.can)) {
        d[x.su_kien as keyof typeof d] += 1;
      }
      if (x.su_kien === 'tang_lai_suat' || x.su_kien === 'ha_lai_suat') {
        let k = i - 1;
        while (k >= 0 && !that(m.o[k], ['tang_lai_suat', 'ha_lai_suat'])) k -= 1;
        const truoc = m.o[k];
        if (truoc?.kind === 'su_kien' && truoc.su_kien !== x.su_kien) {
          const r = LUAT_LA.DAO_CHIEU[x.su_kien];
          const giua = m.o.slice(k + 1, i);
          const coLyDo = giua.some((t) => that(t, r.tin) || pha(t, r.mat))
            || (r.so_la_tang > 0 && giua.filter((t) => pha(t, ['tang'])).length >= r.so_la_tang);
          if (!coLyDo) d.dao_chieu += 1;
        }
      }
    });
  }
  return d;
}

const kyHop = (bs: readonly HoldemMap[]): { m: HoldemMap; i: number; t: TrangThaiO }[] =>
  bs.flatMap((m) => m.o.flatMap((_, i) => (m.trang_thai![i]!.o_lich ? [{ m, i, t: m.trang_thai![i]! }] : [])));
const nguoc = (t: TrangThaiO): boolean =>
  (t.huong_cs_ky_vong === 'ha' && t.huong_cs_thuc === 'tang') || (t.huong_cs_ky_vong === 'tang' && t.huong_cs_thuc === 'ha');

describe('I. Cổng', () => {
  it('v54 bật `luatLa`', () => {
    expect(luatCua(V54).luatLa).toBe(true);
  });

  it('⭐ TẮT cổng = đúng bàn v54 trước D399 từng bit (băm 200 bàn, đo ở worktree HEAD 19daa12 ngày 24/09)', () => {
    let h = 0x811c9dc5;
    const s = JSON.stringify(TAT.slice(0, 200));
    for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    expect(h.toString(16)).toBe('e7358304');
  });

  it('tất định: cùng seed ⇒ cùng bàn khi bật', () => {
    for (let s = 0; s < 30; s += 1) expect(ban(true, s + 1)[s]).toEqual(BAT[s]);
  });
});

describe('II. Lá PHA — tiền đề (founder: "phục hồi từ cái gì?", "vừa sập đã quá nóng")', () => {
  const bat = viPhamPha(BAT);
  const tat = viPhamPha(TAT);

  it('⭐ PHỤC HỒI luôn có đáy (lá GIẢM hoặc cú sốc thật từ lá lên gần nhất)', () => {
    expect(bat.khongDay).toBe(0);
    expect(tat.khongDay).toBeGreaterThan(100);
  });

  it('⭐ QUÁ NÓNG luôn có nhiệt (≥ 2 lá lên, hoặc 1 lá lên + tiền rẻ/bong bóng/lạm phát thật)', () => {
    expect(bat.khongNhiet).toBe(0);
    expect(tat.khongNhiet).toBeGreaterThan(100);
  });

  it('⭐ không có mặt QUÁ NÓNG giữa mùa suy thoái/đình trệ', () => {
    expect(bat.nongGiuaSuy).toBe(0);
    expect(tat.nongGiuaSuy).toBeGreaterThan(200);
  });

  it('⭐ sau khủng hoảng TÀI CHÍNH thật, lá pha kế không phải TĂNG/QUÁ NÓNG', () => {
    expect(bat.tangSauKhungHoang).toBe(0);
    expect(tat.tangSauKhungHoang).toBeGreaterThan(20);
  });

  it('cú sốc NGOẠI SINH rồi TĂNG lại vẫn còn — luật không chặn chuyện đời có (9/11, Brexit)', () => {
    let n = 0;
    for (const m of BAT) {
      m.o.forEach((x, i) => {
        if (pha(x, ['tang']) && that(m.o[i - 1], ['chien_tranh', 'cam_van', 'tham_hoa', 'dich_benh', 'phap_ly'])) n += 1;
      });
    }
    expect(n).toBeGreaterThan(20);
  });

  it('mặt lệch theo nghĩa: PHỤC HỒI GIẢ giữa suy thoái có mặt; lá đúng mùa vẫn trong dải founder chốt, gần như không đổi', () => {
    const phucGia = (bs: readonly HoldemMap[]) => bs.reduce((a, m) => a + m.o.filter((x, i) =>
      pha(x, ['phuc_hoi']) && m.trang_thai![i]!.mua === 'giam').length, 0);
    expect(phucGia(BAT)).toBeGreaterThan(100);
    expect(phucGia(TAT)).toBe(0);
    const dungMua = (bs: readonly HoldemMap[]) => {
      let dung = 0; let tong = 0;
      for (const m of bs) m.o.forEach((x, i) => { if (x.kind === 'giai_doan') { tong += 1; if (x.giai_doan === m.trang_thai![i]!.mua) dung += 1; } });
      return dung / tong;
    };
    // Dải của `banh_xe_mua.test.ts` (rút 80/20; bong bóng lật TĂNG giữa mùa quá nóng kéo thực đo về ~76%). Mặt thay
    // khi mặt thật phạm tiền đề chỉ được ăn một chút nhiễu: đo 6.000 bàn 24/09 tắt 76,5% · bật 75,8%.
    expect(dungMua(BAT)).toBeGreaterThan(0.74);
    expect(dungMua(BAT)).toBeLessThan(0.84);
    expect(Math.abs(dungMua(BAT) - dungMua(TAT))).toBeLessThan(0.015);
  });
});

describe('III. Lá TIN — tiền đề (khủng hoảng phải có ngòi)', () => {
  const bat = viPhamTin(BAT);
  const tat = viPhamTin(TAT);

  it('⭐ không lá tin nào phạm tiền đề (ngoài kỳ họp)', () => {
    expect(bat).toEqual({ hack_san: 0, pha_san: 0, bong_bong: 0, lam_phat: 0, tang_lai_suat: 0, ha_lai_suat: 0, dao_chieu: 0 });
  });

  it('vế ngược: tắt cổng thì có — nhất là sàn khoá rút tiền giữa mùa lành (luật founder 24/09)', () => {
    expect(tat.hack_san).toBeGreaterThan(200);
    expect(tat.pha_san + tat.lam_phat + tat.tang_lai_suat + tat.ha_lai_suat + tat.dao_chieu).toBeGreaterThan(30);
  });

  it('cửa "sau hạ lãi": bong bóng ngay sau lá GIẢM chỉ còn khi có tiền rẻ thật — tắt cổng thì bảng cũ cấm hẳn', () => {
    const sauGiam = (bs: readonly HoldemMap[]) => {
      let co = 0; let khongTienRe = 0;
      for (const m of bs) {
        m.o.forEach((x, i) => {
          if (x.kind !== 'su_kien' || x.su_kien !== 'bong_bong' || !pha(m.o[i - 1], ['giam'])) return;
          co += 1; if (!trongO(m.o, i, 4, ['ha_lai_suat'])) khongTienRe += 1;
        });
      }
      return { co, khongTienRe };
    };
    expect(sauGiam(BAT).co).toBeGreaterThan(0);
    expect(sauGiam(BAT).khongTienRe).toBe(0);
    expect(sauGiam(TAT).co).toBe(0);
  });
});

describe('IV. Máy luật — véc-tơ chép tay', () => {
  it('lá PHA', () => {
    expect(matHopLe('phuc_hoi', [])).toBe(true);
    expect(matHopLe('phuc_hoi', [gd('tang')])).toBe(false);
    expect(matHopLe('phuc_hoi', [gd('tang'), gd('giam')])).toBe(true);
    expect(matHopLe('phuc_hoi', [gd('tang'), tin('dich_benh')])).toBe(true);
    expect(matHopLe('phuc_hoi', [gd('tang'), tin('dich_benh', true)])).toBe(false);
    expect(matHopLe('phuc_hoi', [gd('giam'), gd('phuc_hoi'), gd('tang')])).toBe(false);
    expect(matHopLe('bien_dong', [])).toBe(true);
    expect(matHopLe('bien_dong', [gd('giam'), gd('tang')])).toBe(false);
    expect(matHopLe('bien_dong', [gd('giam'), gd('tang'), gd('tang')])).toBe(true);
    expect(matHopLe('bien_dong', [gd('giam'), tin('ha_lai_suat')])).toBe(false);
    expect(matHopLe('bien_dong', [gd('giam'), tin('ha_lai_suat'), gd('tang')])).toBe(true);
    expect(matHopLe('tang', [gd('tang'), tin('pha_san')])).toBe(false);
    expect(matHopLe('tang', [gd('tang'), tin('pha_san', true)])).toBe(true);
    expect(matHopLe('tang', [gd('tang'), tin('chien_tranh')])).toBe(true);
    expect(matHopLe('giam', [gd('tang'), tin('hack_san')])).toBe(true);
  });

  it('mặt lệch phạm luật ⇒ mặt lệch khác của mùa; mặt thật phạm ⇒ mặt thay', () => {
    // Suy thoái vừa vào, chưa lật GIẢM nào: PHỤC HỒI GIẢ chưa được ⇒ ĐI NGANG (mặt lệch kia).
    expect(giaiMat({ mat: 'phuc_hoi', prior: 1000 }, 'giam', [gd('tang')]).mat).toBe('di_ngang');
    // Mùa phục hồi mà chưa từng thấy đáy ⇒ đáy lộ muộn: GIẢM.
    expect(giaiMat({ mat: 'phuc_hoi', prior: 8000 }, 'phuc_hoi', [gd('tang'), gd('di_ngang')]).mat).toBe('giam');
    // Quá nóng chưa đủ nhiệt ⇒ TĂNG.
    expect(giaiMat({ mat: 'bien_dong', prior: 8000 }, 'bien_dong', [gd('phuc_hoi'), gd('tang')]).mat).toBe('tang');
    // Prior sau luật cộng mọi cú rút dẫn tới cùng mặt: không lá nào phạm ⇒ đúng mùa 80%.
    expect(giaiMat({ mat: 'giam', prior: 8000 }, 'giam', [gd('giam')]).prior).toBe(8000);
  });

  it('lá TIN', () => {
    expect(tinHopLe('hack_san', 'tang', [gd('tang'), gd('tang')])).toBe(false);
    expect(tinHopLe('hack_san', 'tang', [gd('tang'), tin('chien_tranh'), gd('tang')])).toBe(true);
    expect(tinHopLe('hack_san', 'tang', [gd('tang'), tin('chien_tranh', true), gd('tang')])).toBe(false);
    expect(tinHopLe('hack_san', 'giam', [gd('giam')])).toBe(true);
    expect(tinHopLe('pha_san', 'phuc_hoi', [gd('phuc_hoi'), tin('tang_lai_suat'), gd('phuc_hoi')])).toBe(true);
    expect(tinHopLe('pha_san', 'phuc_hoi', [gd('phuc_hoi'), gd('phuc_hoi')])).toBe(false);
    expect(tinHopLe('lam_phat', 'giam', [gd('giam'), gd('giam')])).toBe(false);
    expect(tinHopLe('lam_phat', 'giam', [gd('giam'), tin('cam_van'), gd('giam')])).toBe(true);
    // Đảo chiều lãi suất ngoài kỳ họp cần lý do ở giữa.
    expect(tinHopLe('ha_lai_suat', 'tang', [tin('tang_lai_suat'), gd('tang')])).toBe(false);
    expect(tinHopLe('ha_lai_suat', 'tang', [tin('tang_lai_suat'), gd('giam')])).toBe(true);
    expect(tinHopLe('tang_lai_suat', 'tang', [tin('ha_lai_suat'), gd('tang')])).toBe(false);
    expect(tinHopLe('tang_lai_suat', 'tang', [tin('ha_lai_suat'), gd('tang'), gd('tang')])).toBe(true);
    // Tin ngoại sinh không có tiền đề.
    expect(tinHopLe('chien_tranh', 'tang', [gd('tang')])).toBe(true);
  });
});

describe('V. Kỳ họp — sai phần lớn là chậm nhịp; ngược chiều hiếm, có hệ quả, rồi sửa sai', () => {
  const tyNguoc = (bs: readonly HoldemMap[]) => {
    const doi = kyHop(bs).filter(({ t }) => t.huong_cs_ky_vong !== 'giu');
    return doi.filter(({ t }) => nguoc(t)).length / doi.length;
  };

  it('⭐ đi NGƯỢC hàm phản ứng hiếm hơn hẳn (15% × 20% ≈ 3%; tắt cổng ≈ 7,5%)', () => {
    expect(tyNguoc(BAT)).toBeLessThan(0.045);
    expect(tyNguoc(TAT)).toBeGreaterThan(0.06);
  });

  it('⭐ kỳ họp kế sau một lần ngược chiều đi đúng hàm phản ứng (sửa sai)', () => {
    const sauNguoc = (bs: readonly HoldemMap[]) => bs.flatMap((m) => {
      const ds = kyHop([m]);
      return ds.slice(1).filter((_, k) => nguoc(ds[k]!.t)).map(({ t }) => t.huong_cs_thuc === t.huong_cs_ky_vong);
    });
    const bat = sauNguoc(BAT); const tat = sauNguoc(TAT);
    expect(bat.length).toBeGreaterThan(15);
    expect(bat.every(Boolean)).toBe(true);
    expect(tat.every(Boolean)).toBe(false);
  });

  it('⭐ hàm phản ứng đòi GIỮ mà sai ⇒ QUÁ TAY theo hướng lần đổi lãi thật gần nhất, không quay ngoắt', () => {
    const quaTay = (bs: readonly HoldemMap[]) => {
      let dung = 0; let tong = 0;
      for (const { m, i, t } of kyHop(bs)) {
        if (t.huong_cs_ky_vong !== 'giu' || t.huong_cs_thuc === 'giu') continue;
        let k = i - 1;
        while (k >= 0 && !that(m.o[k], ['tang_lai_suat', 'ha_lai_suat'])) k -= 1;
        const truoc = m.o[k];
        if (truoc?.kind !== 'su_kien') continue;
        tong += 1; if ((truoc.su_kien === 'tang_lai_suat' ? 'tang' : 'ha') === t.huong_cs_thuc) dung += 1;
      }
      return { dung, tong };
    };
    const bat = quaTay(BAT); const tat = quaTay(TAT);
    expect(bat.tong).toBeGreaterThan(30);
    expect(bat.dung).toBe(bat.tong);
    expect(tat.dung / tat.tong).toBeLessThan(0.7);
  });

  it('⭐ hệ quả: siết sai giữa suy thoái ⇒ phá sản dễ tới hơn và suy thoái kéo dài (so với cùng bàn bỏ hệ quả)', () => {
    const doHeQua = (bs: readonly HoldemMap[]) => {
      let trung = 0; let tong = 0; let conO = 0; let soMua = 0;
      for (const m of bs) {
        m.o.forEach((_, i) => {
          const t = m.trang_thai![i]!;
          if (!t.o_lich || t.huong_cs_ky_vong !== 'ha' || t.huong_cs_thuc !== 'tang') return;
          tong += 1;
          if (m.o.slice(i + 1, i + 5).some((y) => y.kind === 'su_kien' && y.su_kien === 'pha_san')) trung += 1;
          let k = 0; let j = i + 1;
          for (; j < m.o.length && m.trang_thai![j]!.mua === t.mua; j += 1) if (m.o[j]!.kind === 'giai_doan') k += 1;
          if (j < m.o.length) { conO += k; soMua += 1; }
        });
      }
      return { ty: trung / tong, tbConO: conO / soMua, tong };
    };
    const coHeQua = doHeQua(ban(true, 6000));
    // Cùng seed, cùng cổng, chỉ gỡ hệ quả (ghi đè trong process, hoàn lại ngay) — cô lập đúng một cần gạt.
    const HQ = LUAT_LA.SAI_LAM.HE_QUA.tang as { TIN_X_BP: unknown; KEO_DAI_O: number };
    const cu = { x: HQ.TIN_X_BP, o: HQ.KEO_DAI_O };
    HQ.TIN_X_BP = {}; HQ.KEO_DAI_O = 0;
    let boHeQua: ReturnType<typeof doHeQua>;
    try { boHeQua = doHeQua(ban(true, 6000)); } finally { HQ.TIN_X_BP = cu.x; HQ.KEO_DAI_O = cu.o; }
    expect(coHeQua.tong).toBeGreaterThan(100);
    expect(coHeQua.ty).toBeGreaterThan(boHeQua.ty * 2);
    expect(coHeQua.tbConO).toBeGreaterThan(boHeQua.tbConO + 0.4);
  });
});
