/**
 * VAI CÓ RĂNG — `balance-v34-vai` (founder 22/08: "Làm đi").
 *
 * Bước 1 (D107) chỉ dán NHÃN vai. Bước này cho vai ĐỔI CHIP, nên phải qua cổng
 * `vaiCoRang` và khoá bốn răng + một hàng rào:
 *   §I   VỐN + LÕI GHIM theo vai lúc tạo trận (đội lái ×3 chip, ghim Lướt Sóng);
 *   §II  TÁC ĐỘNG GIÁ riêng ghế — nhân vào TRƯỢT GIÁ và CHEN CHÚC;
 *   §III SIẾT PHÁP LÝ — đội lái phơi nhiễm ≥ ngưỡng đúng ô pháp lý ⇒ trừ Vốn;
 *   §IV  HÀNG RÀO REPLAY — trận ≤ v33 có nhãn vai nhưng KHÔNG đổi một chip nào.
 *
 * ⚠ §IV là bài quan trọng nhất: D107 đã dán nhãn `vai` lên ghế của MỌI trận map
 * 12 từ 22/08. Nếu răng cắn theo nhãn mà không hỏi cổng thì mọi trận v33 đang
 * lưu replay ra vốn khác — đúng lớp lỗi kỳ ngộ v31 (D87).
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_MATCH, MANDATE_TO_CHUC, SIET_DOI_LAI, luatCua } from '../config/holdem.js';
import {
  apLenhMocNav, dongTienThoCua, giaiQuyetVong, heSoTacDongGia, mandateCua, taoTran, vonDauCua,
  xepHang, type GheMoi,
} from '../server/holdem/engine.js';
import { apLenhGiaoDich, navCua, type GheNav } from '../server/holdem/nav.js';
import { VAI } from '../server/holdem/vai.js';
import type { OSuKien } from '../server/holdem/map.js';

const V34 = 'balance-v34-vai';
const V33 = 'balance-v33-gianla';
const THEO = () => ({ loai: 'theo' as const });

const gheMoi = (id: string, vai?: GheMoi['vai']): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
  ...(vai ? { vai } : {}),
});

/** Bàn 4 ghế đủ bốn vai, map 12 (vai chỉ sống ở map ≥ 12). */
const banVai = (phienBan: string, seed = 11) => taoTran(seed, [
  gheMoi('dl', 'doi_lai'), gheMoi('cn', 'ca_nhan'), gheMoi('cm', 'ca_map'), gheMoi('tc', 'to_chuc'),
], luatCua(phienBan), 12);

describe('I. vốn + lõi ghim theo vai lúc tạo trận', () => {
  it('v34: đội lái nhận ×3 chip và cầm sẵn Lướt Sóng; cá nhân ×1, không ghim', () => {
    const st = banVai(V34);
    const dl = st.ghe.find((g) => g.id === 'dl')!;
    const cn = st.ghe.find((g) => g.id === 'cn')!;
    expect(dl.von).toBe(HOLDEM_MATCH.START_VON * VAI.doi_lai.he_so_von);
    expect(dl.danh_muc.chien_thuat).toContain('luot_song');
    expect(cn.von).toBe(HOLDEM_MATCH.START_VON);
    expect(cn.danh_muc.chien_thuat).toEqual([]);
    expect(st.vai_co_rang).toBe(true);
  });

  it('cổng: v33 khai vaiCoRang=false, v34 khai true — và mọi phiên bản cũ đều false', () => {
    expect(luatCua(V34).vaiCoRang).toBe(true);
    expect(luatCua(V33).vaiCoRang).toBe(false);
    for (const pb of ['balance-v32-bansac', 'balance-v29-voivang', 'balance-v21-cantroi', 'khong-ton-tai']) {
      expect(luatCua(pb).vaiCoRang).toBe(false);
    }
  });
});

describe('II. tác động giá — riêng ghế, nhân vào trượt giá và chen chúc', () => {
  it('heSoTacDongGia: cá mập > 1 (giá của Đòn Bẩy ghim), tổ chức < 1 (khớp êm), cá nhân = 1, không vai = 1', () => {
    const st = banVai(V34);
    const hs = (id: string) => heSoTacDongGia(st, st.ghe.find((g) => g.id === id)!);
    expect(hs('cm')).toBe(VAI.ca_map.tac_dong_gia);
    expect(hs('tc')).toBe(VAI.to_chuc.tac_dong_gia);
    expect(hs('cn')).toBe(1);
    expect(VAI.ca_map.tac_dong_gia).toBeGreaterThan(1);
    expect(VAI.to_chuc.tac_dong_gia).toBeLessThan(1);
    const khongVai = taoTran(11, [gheMoi('x'), gheMoi('y')], luatCua(V34), 12);
    expect(heSoTacDongGia(khongVai, khongVai.ghe[0]!)).toBe(1);
  });

  it('trượt giá: cùng một lệnh, hệ số 1,5 trả phí = floor(phí gốc × 1,5) — nhân sau cùng, floor một lần', () => {
    const dung = (): GheNav => ({ von: 10_000, vi_the: {}, gia_von: {}, danh_muc: { tai_san: [], chien_thuat: [] } } as never);
    const lenh = [{ ma: 'btc', chieu: 'mua' as const, tien: 8_000 }];
    const g1 = dung(); const r1 = apLenhGiaoDich(g1, lenh, { voiVang: true });
    const g2 = dung(); const r2 = apLenhGiaoDich(g2, lenh, { voiVang: true, tacDongGia: 1.5 });
    const g3 = dung(); const r3 = apLenhGiaoDich(g3, lenh, { voiVang: true, tacDongGia: 0.5 });
    expect(r1.loi).toBeNull(); expect(r2.loi).toBeNull(); expect(r3.loi).toBeNull();
    // Phí lệch ⇒ vị thế mua được lệch. Đo qua NAV sau lệnh (phí là phần bốc hơi).
    const mat1 = 10_000 - navCua(g1);
    const mat2 = 10_000 - navCua(g2);
    const mat3 = 10_000 - navCua(g3);
    expect(mat1).toBeGreaterThan(0); // phép so không rỗng
    expect(mat2).toBe(Math.floor(mat1 * 1.5));
    expect(mat3).toBe(Math.floor(mat1 * 0.5));
  });

  it('chen chúc: cùng một mã cả bàn cùng ôm, crowding của cá mập = floor(gốc × 1,5), tổ chức = floor(gốc × 0,75); cá nhân = đội lái = gốc', () => {
    // Quét seed tới khi vòng 1 sinh crowding cho cả bàn (không thì phép so rỗng).
    let daSo = 0;
    for (let seed = 1; seed <= 60 && daSo < 3; seed += 1) {
      let st = banVai(V34, seed);
      for (const id of ['dl', 'cn', 'cm']) {
        const r = apLenhMocNav(st, id, [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]);
        if (!r.ok) continue;
        st = r.st;
      }
      // Tổ chức bị mandate 40% ⇒ mua 2500bp (hợp mandate) — crowding đếm ĐẦU GHẾ nên vẫn là một người nắm.
      const rt = apLenhMocNav(st, 'tc', [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
      if (rt.ok) st = rt.st;
      const kq = giaiQuyetVong(st, THEO).ketQua;
      const cw = (id: string) => kq.ket_qua.find((k) => k.ghe_id === id)?.chain
        .find((m) => m.kind === 'crowding' && (m as { id?: string }).id === 'btc') as { delta_bp: number } | undefined;
      const dl = cw('dl'); const cn = cw('cn'); const cm = cw('cm'); const tc = cw('tc');
      if (!dl || !cn || !cm || !tc) continue;
      daSo += 1;
      // Phạt KHÔNG phụ thuộc vốn ghế (đội lái ×3 vốn = cá nhân ×1), chỉ theo hệ số vai.
      expect(dl.delta_bp).toBe(cn.delta_bp);
      const goc = -cn.delta_bp;
      expect(-cm.delta_bp).toBe(Math.floor(goc * VAI.ca_map.tac_dong_gia));
      expect(-tc.delta_bp).toBe(Math.floor(goc * VAI.to_chuc.tac_dong_gia));
      expect(-cm.delta_bp).toBeGreaterThan(goc);
    }
    expect(daSo).toBeGreaterThanOrEqual(1);
  });
});

describe('III. SIẾT PHÁP LÝ — cái giá của đội lái', () => {
  const oPhapLy: OSuKien = {
    kind: 'su_kien', su_kien: 'phap_ly', la_tin_gia: false, boi_canh: 'don_doc', bao_truoc: 'bien_dong',
  };
  const dungBan = (phienBan: string, mocBp: number) => {
    let st = banVai(phienBan, 5);
    st = { ...st, map: { ...st.map, o: [oPhapLy, ...st.map.o.slice(1)] } };
    const r = apLenhMocNav(st, 'dl', [{ ma: 'btc', chieu: 'mua', moc_bp: mocBp }]);
    expect(r.ok).toBe(true);
    return r.st;
  };

  it('v34: đội lái ôm ≥ ngưỡng đúng ô pháp lý ⇒ trừ thẳng MAT_CHIP, có dòng siet_doi_lai', () => {
    const st = dungBan(V34, 10000);
    const vonTruoc = st.ghe.find((g) => g.id === 'dl')!.von;
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.siet_doi_lai).toEqual([{ ghe_id: 'dl', mat: SIET_DOI_LAI.MAT_CHIP }]);
    const dlSau = r.trangThai.ghe.find((g) => g.id === 'dl')!;
    // ⭐ All-in ⇒ tiền mặt ≈ 0 ⇒ khoản siết PHẢI ăn vào VỊ THẾ (không thì all-in né được cái giá).
    expect(vonTruoc).toBeLessThan(SIET_DOI_LAI.MAT_CHIP);
    // von_sau ghi trên ket_qua PHẢI phản ánh cú trừ (UI đọc số này).
    expect(r.ketQua.ket_qua.find((k) => k.ghe_id === 'dl')!.von_sau).toBe(dlSau.von);
    // Đối chứng: cùng bàn, cùng lệnh, chỉ khác ô không phải pháp lý ⇒ NAV cao hơn đúng cỡ khoản siết.
    const stKhong = banVai(V34, 5);
    const r2 = giaiQuyetVong(apLenhMocNav(
      { ...stKhong, map: { ...stKhong.map, o: [{ ...oPhapLy, su_kien: 'cam_van' }, ...stKhong.map.o.slice(1)] } },
      'dl', [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]).st, THEO);
    expect(r2.ketQua.siet_doi_lai).toEqual([]);
  });

  it('⭐ gọi ký quỹ (D37) cũng trừ từ NAV ở v34 — người all-in cầm Đòn Bẩy không né được nữa', () => {
    // Ghế cầm Đòn Bẩy, all-in, lỗ ≥ ngưỡng thường ⇒ v33: ký quỹ RỖNG (0 tiền mặt); v34: có dòng.
    const chay = (pb: string) => {
      let daSo = 0; let coKyQuy = 0;
      for (let seed = 1; seed <= 80; seed += 1) {
        let st = taoTran(seed, [gheMoi('a'), gheMoi('b'), gheMoi('c')], luatCua(pb), 12);
        st = { ...st, ghe: st.ghe.map((g) => (g.id === 'a'
          ? { ...g, danh_muc: { ...g.danh_muc, chien_thuat: ['don_bay' as never] } } : g)) };
        const r0 = apLenhMocNav(st, 'a', [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]);
        if (!r0.ok) continue;
        const r = giaiQuyetVong(r0.st, THEO);
        const a = r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')!;
        if (a.pnl_bp > -1800) continue; // chưa chạm ngưỡng thường
        daSo += 1;
        if (r.ketQua.goi_ky_quy.some((x) => x.ghe_id === 'a')) coKyQuy += 1;
      }
      return { daSo, coKyQuy };
    };
    const v33 = chay(V33); const v34 = chay(V34);
    expect(v33.daSo).toBeGreaterThan(0); // phép so không rỗng
    expect(v33.coKyQuy).toBe(0);          // ← chính cái lỗ: all-in thì không bao giờ bị gọi
    expect(v34.coKyQuy).toBe(v34.daSo);   // v34: vòng nào chạm ngưỡng là bị gọi
  });

  it('dưới ngưỡng phơi nhiễm ⇒ không siết (tránh được bằng cách hạ vị thế trước)', () => {
    const st = dungBan(V34, 2500);
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.siet_doi_lai).toEqual([]);
  });

  it('cá nhân ôm 100% cùng ô ⇒ KHÔNG siết — răng chỉ cắn đội lái', () => {
    let st = banVai(V34, 5);
    st = { ...st, map: { ...st.map, o: [oPhapLy, ...st.map.o.slice(1)] } };
    st = apLenhMocNav(st, 'cn', [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]).st;
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.siet_doi_lai).toEqual([]);
  });
});

describe('V. CÁ MẬP + TỔ CHỨC cho NGƯỜI (founder 22/08) — hai đích · mandate · xếp hạng % · phí quy chiếu', () => {
  it('xếp hạng cuối theo % TĂNG TRƯỞNG so vốn vai: cá mập 30k ngồi im (×3 vốn) KHÔNG trên cá nhân 10k lãi', () => {
    let st = banVai(V34, 3);
    st = apLenhMocNav(st, 'cn', [{ ma: 'vn30', chieu: 'mua', moc_bp: 5000 }]).st;
    const cn = st.ghe.find((g) => g.id === 'cn')!;
    const cm = st.ghe.find((g) => g.id === 'cm')!;
    // Ép NAV: cá nhân +20%, cá mập đứng yên — đặt trực tiếp để bài không phụ thuộc seed.
    const stEp = { ...st, ghe: st.ghe.map((g) => (g.id === 'cn'
      ? { ...g, von: g.von + Math.floor(HOLDEM_MATCH.START_VON * 0.2) } : g)) };
    const hang = xepHang(stEp);
    expect(navCua(cm)).toBeGreaterThan(navCua(cn) + 2000); // NAV tuyệt đối cá mập vẫn to hơn hẳn
    expect(hang.indexOf('cn')).toBeLessThan(hang.indexOf('cm')); // nhưng hạng theo % ⇒ cá nhân trên
    // v33: cùng trạng thái, xếp theo NAV tuyệt đối ⇒ cá mập trên (mọi ghế cùng mẫu số START_VON).
    const { vai_co_rang: _bo, ...st33 } = stEp;
    const h33 = xepHang(st33);
    expect(h33.indexOf('cm')).toBeLessThan(h33.indexOf('cn'));
  });

  it('mandate tổ chức: mua làm một mã > 40% NAV ⇒ từ chối `mandate_ma`; ≤ 40% ⇒ qua; cá nhân mua 100% vẫn qua', () => {
    const st = banVai(V34, 3);
    expect(mandateCua(st, st.ghe.find((g) => g.id === 'tc')!)).toEqual({ tranMaBp: MANDATE_TO_CHUC.TRAN_MA_BP, camKhong: true });
    expect(mandateCua(st, st.ghe.find((g) => g.id === 'cn')!)).toBeUndefined();
    const r50 = apLenhMocNav(st, 'tc', [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]);
    expect(r50.ok).toBe(false); expect(r50.loi).toBe('mandate_ma');
    const r25 = apLenhMocNav(st, 'tc', [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    expect(r25.ok).toBe(true);
    // Rải: 25% × 4 mã khác nhau hợp mandate (trần số mã: Đa Dạng Hoá ghim nới +1).
    const rRai = apLenhMocNav(st, 'tc', ['btc', 'vn30', 'vang', 'usd'].map((ma) => ({ ma, chieu: 'mua' as const, moc_bp: 2500 })));
    expect(rRai.ok).toBe(true);
    expect(apLenhMocNav(st, 'cn', [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]).ok).toBe(true);
  });

  it('mandate: mã vượt trần vì GIÁ CHẠY thì bán vẫn được, nhưng MUA THÊM mã đó bị từ chối', () => {
    let st = banVai(V34, 3);
    st = apLenhMocNav(st, 'tc', [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]).st;
    // Ép vị thế btc vọt lên ~60% NAV như thể giá chạy.
    const tc = st.ghe.find((g) => g.id === 'tc')!;
    const ep = { ...st, ghe: st.ghe.map((g) => (g.id === 'tc' ? { ...g, vi_the: { btc: tc.von * 2 } } : g)) };
    expect(apLenhMocNav(ep, 'tc', [{ ma: 'btc', chieu: 'ban', moc_bp: 5000 }]).ok).toBe(true);
    const rMua = apLenhMocNav(ep, 'tc', [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    expect(rMua.ok).toBe(false); expect(rMua.loi).toBe('mandate_ma');
  });

  it('hai đích Đòn Bẩy (cấp 2): cá mập cầm 2 Đòn Bẩy + gan_phu ⇒ mắt xích nhân mang ma_phu và cộng phần CẢ HAI mã', () => {
    let daSo = 0;
    for (let seed = 1; seed <= 40 && daSo < 2; seed += 1) {
      let st = banVai(V34, seed);
      st = { ...st, ghe: st.ghe.map((g) => (g.id === 'cm'
        ? { ...g, danh_muc: { ...g.danh_muc, chien_thuat: ['don_bay', 'don_bay'] as never, gan: { don_bay: 'btc' }, gan_phu: { don_bay: 'vang' } } } : g)) };
      const r = apLenhMocNav(st, 'cm', [
        { ma: 'btc', chieu: 'mua', moc_bp: 2500 }, { ma: 'vang', chieu: 'mua', moc_bp: 2500 }, { ma: 'usd', chieu: 'mua', moc_bp: 2500 },
      ]);
      if (!r.ok) continue;
      const kq = giaiQuyetVong(r.st, THEO).ketQua.ket_qua.find((k) => k.ghe_id === 'cm')!;
      const nhan = kq.chain.find((m) => m.kind === 'nhan') as { ma?: string; ma_phu?: string; delta_bp: number } | undefined;
      if (!nhan) continue;
      daSo += 1;
      expect(nhan.ma).toBe('btc'); expect(nhan.ma_phu).toBe('vang');
      const theoMa = (ma: string) => kq.chain.filter((m) => ['tai_san', 'echo', 'crowding', 'hoan_truot'].includes(m.kind)
        && (m as { id?: string }).id === ma).reduce((t, m) => t + m.delta_bp, 0);
      expect(nhan.delta_bp).toBe(theoMa('btc') + theoMa('vang'));
      // Cùng bàn, chỉ CẤP 1 ⇒ đích phụ bị bỏ qua: chỉ cộng phần btc.
      const st1 = { ...r.st, ghe: r.st.ghe.map((g) => (g.id === 'cm'
        ? { ...g, danh_muc: { ...g.danh_muc, chien_thuat: ['don_bay'] as never } } : g)) };
      const kq1 = giaiQuyetVong(st1, THEO).ketQua.ket_qua.find((k) => k.ghe_id === 'cm')!;
      const nhan1 = kq1.chain.find((m) => m.kind === 'nhan') as { ma_phu?: string; delta_bp: number };
      expect(nhan1.ma_phu).toBeUndefined();
      expect(nhan1.delta_bp).toBe(theoMa('btc'));
    }
    expect(daSo).toBeGreaterThanOrEqual(1);
  });

  it('phí vội vàng quy chiếu VỐN VAI: đội lái 30k đặt 50% trả cùng % phí như cá nhân 10k đặt 50%; cá mập ×1,5', () => {
    const st = banVai(V34, 3);
    const phi = (id: string) => {
      const r = apLenhMocNav(st, id, [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]);
      expect(r.ok).toBe(true);
      const g = r.st.ghe.find((x) => x.id === id)!;
      return (vonDauCua(st, g) - navCua(g)) / vonDauCua(st, g);
    };
    expect(phi('cn')).toBeGreaterThan(0);
    expect(Math.abs(phi('dl') - phi('cn'))).toBeLessThan(0.001);
    expect(phi('cm') / phi('cn')).toBeGreaterThan(1.45);
    expect(phi('cm') / phi('cn')).toBeLessThan(1.55);
  });

  it('dòng tiền thô: vắng/vừa/đông đọc từ số ghế nắm, không lộ số', () => {
    let st = banVai(V34, 3);
    for (const id of ['dl', 'cn', 'cm']) st = apLenhMocNav(st, id, [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]).st;
    const dt = dongTienThoCua(st);
    expect(dt.btc).toBe('dong');
    expect(dt.vang).toBe('vang');
    expect(Object.values(dt).every((v) => ['vang', 'vua', 'dong'].includes(v))).toBe(true);
  });
});

describe('IV. HÀNG RÀO REPLAY — nhãn vai có từ D107, răng chỉ mọc ở v34', () => {
  it('v33: ghế mang vai nhưng vốn = START_VON, không ghim, hệ số 1, không siết', () => {
    const st = banVai(V33);
    const dl = st.ghe.find((g) => g.id === 'dl')!;
    expect(dl.vai).toBe('doi_lai'); // nhãn VẪN có (replay D107)
    expect(dl.von).toBe(HOLDEM_MATCH.START_VON);
    expect(dl.danh_muc.chien_thuat).toEqual([]);
    expect(st.vai_co_rang).toBeUndefined();
    expect(heSoTacDongGia(st, dl)).toBe(1);
  });

  it('v33 cặp song sinh: bàn CÓ nhãn vai ≡ bàn KHÔNG nhãn từng chip qua 4 vòng (nhãn không đổi một chip)', () => {
    const chay = (coNhan: boolean) => {
      let st = taoTran(7, [
        gheMoi('dl', coNhan ? 'doi_lai' : undefined), gheMoi('cn', coNhan ? 'ca_nhan' : undefined),
        gheMoi('cm', coNhan ? 'ca_map' : undefined), gheMoi('tc', coNhan ? 'to_chuc' : undefined),
      ], luatCua(V33), 12);
      for (const id of ['dl', 'cn']) {
        st = apLenhMocNav(st, id, [{ ma: 'vn30', chieu: 'mua', moc_bp: 5000 }]).st;
      }
      for (let v = 0; v < 4; v += 1) st = giaiQuyetVong(st, THEO).trangThai;
      return st.ghe.map((g) => [g.id, navCua(g), g.von]);
    };
    expect(chay(true)).toEqual(chay(false));
  });

  it('v34 cặp song sinh: cùng lệnh 50%, cá mập (×1,5) và cá nhân (×1) ra % tăng trưởng KHÁC nhau (răng có cắn thật)', () => {
    let st = banVai(V34, 7);
    for (const id of ['cm', 'cn']) {
      st = apLenhMocNav(st, id, [{ ma: 'vn30', chieu: 'mua', moc_bp: 5000 }]).st;
    }
    for (let v = 0; v < 4; v += 1) st = giaiQuyetVong(st, THEO).trangThai;
    const tt = (id: string) => {
      const g = st.ghe.find((x) => x.id === id)!;
      return Math.floor((navCua(g) * 10000) / vonDauCua(st, g));
    };
    expect(tt('cm')).not.toBe(tt('cn'));
  });

  it('⭐ canh cả lớp: heSoTacDongGia và khối SIẾT đều hỏi cổng `vai_co_rang` ngay trong mã nguồn', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../server/holdem/engine.ts', import.meta.url), 'utf8');
    const hs = src.slice(src.indexOf('export function heSoTacDongGia'));
    expect(hs.slice(0, 300)).toMatch(/vai_co_rang\s*!==\s*true/);
    const siet = src.slice(src.indexOf('SIẾT PHÁP LÝ: đội lái bị bắt'));
    expect(siet.slice(0, 600)).toMatch(/st\.vai_co_rang\s*===\s*true/);
  });
});
