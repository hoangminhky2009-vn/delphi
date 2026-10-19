/**
 * D314 — NGÂN HÀNG GỬI TIẾT KIỆM (`balance-v43-nganhang`) + KHOÁ NẮM GIỮ TẮT.
 *
 * Vector tiền §II–§IV chép tay TRƯỚC khi viết code (A8.3), lấy từ §7.1 của
 * `docs/yeu-cau-ky-thuat/08-tai-san-v2-ngan-hang-lam-phat.md`. Đổi một hằng số kinh tế
 * mà quên sửa ở đây là ĐỎ — đúng ý.
 *
 * ⚠ §V khoá một BẤT BIẾN CÓ CẤU TRÚC, không phải một con số: ở kết thúc tự nhiên KHÔNG
 * hợp đồng nào còn mở, vì `kipDaoHanTietKiem` không cho mở cái nào đáo hạn sau ô cuối.
 * Nếu ai nới phép kiểm ấy thì bài này đỏ trước khi người chơi gặp một lời hứa không bao
 * giờ được nghiệm thu.
 */
import { describe, expect, it } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, LAI_SUAT_NEN, laiTietKiemBp, luatCua,
  TIET_KIEM,
} from '../config/holdem.js';
import {
  apHuyTietKiem, apKhoaTaiSan, apMoTietKiem, huyMoiHopDong, kipDaoHanTietKiem, mocKipCua,
  tatToanKhiDongTran, tongTietKiem, type Ghe, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { navCua, navTuDo, type GheNav } from '../server/holdem/nav.js';

const V43 = 'balance-v43-nganhang';

/** Ghế tối thiểu cho hai lệnh tiết kiệm. */
const ghe = (von: number, them: Partial<Ghe> = {}): Ghe => ({
  id: 'ban', loai: 'nguoi', bac_rank: 'tom', von, luot_khao_sat: 0,
  danh_muc: { tai_san: [], chien_thuat: [] },
  da_chay: false, tu_the: 'choi', so_lan_cat_lo: 0, vi_the: {},
  ...them,
} as unknown as Ghe);

/** Trạng thái tối thiểu: bàn `soO` ô, đang ở vòng `vong`, ngân hàng BẬT. */
const st = (vong: number, g: Ghe, soO = 12, them: Record<string, unknown> = {}):
TrangThaiTran => ({
  vong, ghe: [g], ngan_hang: true, dac_quyen: false,
  map: { o: Array.from({ length: soO }, () => ({ kind: 'giai_doan', giai_doan: 'di_ngang' })) },
  ...them,
} as unknown as TrangThaiTran);

const soCua = (k: string) => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? NaN);

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Công thức lãi và mốc kỳ hạn', () => {
  it('⭐ lãi nền 400, mốc 4 ô ⇒ 200 + 50 + 25 = 275 bp/ô', () => {
    expect(laiTietKiemBp(400, 4)).toBe(275);
  });

  it('⭐ bậc thang LÊN RỒI PHẲNG ở đỉnh — và chỗ phẳng là CÓ CHỦ Ý', () => {
    /*
     * ⚠⚠ ĐỌC TRƯỚC KHI "SỬA CHO ĐÚNG NGOÀI ĐỜI". Mốc 3 và mốc 4 trả CÙNG một
     * lãi suất/ô. Ngoài đời đường cong thường dốc lên, nên bản năng của người
     * đọc tiếp theo sẽ là nâng mốc 4. ĐỪNG — bộ đầu (0/50/100 + bù 50) đã làm
     * đúng thế và G5b ĐỎ ở CẢ BA cỡ map: `tk_4` là mốc tốt nhất mọi nơi, tức
     * "chọn kỳ hạn" thành nút "chọn 4 luôn". Bản dốc-đều-thoải-hơn (0/25/50)
     * cũng được đo, và TÁI TẠO ĐÚNG lỗi ấy (tk_4 3,60 vs tk_3 4,14).
     *
     * Lý do vật lý: trong một trận ngắn, khoá tiền lâu gần như không mất gì,
     * mà mốc dài lại ăn lãi NHIỀU Ô HƠN — nên bất kỳ phần bù kỳ hạn dương nào
     * cũng làm mốc dài nhất thắng tuyệt đối. Chỗ phẳng là câu bộ số đang nói:
     * *quá 3 ô thì anh trả thêm thanh khoản mà không mua thêm được gì.*
     *
     * Bài này khoá HÌNH DẠNG, không khoá ba con số — đổi lãi nền vẫn đúng.
     */
    const [a, b, c] = [2, 3, 4].map((v) => laiTietKiemBp(400, v));
    expect(a!).toBeLessThan(b!);   // mốc 2 → 3 vẫn PHẢI lên: có thưởng kỳ hạn
    expect(c!).toBe(b!);           // 3 → 4 PHẲNG: hết đường mua thêm lãi
    expect([a, b, c]).toEqual([250, 275, 275]);
  });

  it('⭐ phần bù DƯƠNG so coupon trái phiếu — "lãi cố định cao" phải đo được', () => {
    /*
     * Nếu gửi tiết kiệm trả ÍT hơn coupon thì không ai gửi, và cả cơ chế là code chết.
     * Nếu nó trả cao hơn mà KHÔNG mất gì thì nó là bến an toàn miễn phí (G5 canh).
     * Cái phải đúng ở đây là vế thứ nhất; vế thứ hai là việc của gate.
     */
    const coupon = Math.floor(LAI_SUAT_NEN.KHOI_DIEM / TIET_KIEM.O_MOI_NAM);
    for (const n of TIET_KIEM.MOC) {
      expect(laiTietKiemBp(LAI_SUAT_NEN.KHOI_DIEM, n), `mốc ${n}`).toBeGreaterThan(coupon);
    }
  });

  it('founder chốt ba mốc 2·3·4 và KHÔNG giới hạn số hợp đồng', () => {
    expect([...TIET_KIEM.MOC]).toEqual([2, 3, 4]);
    expect(TIET_KIEM.TRAN_SO_HOP_DONG).toBeNull();
  });

  it('V11 — kịp đáo hạn: bàn 8 ô, vòng 7 thì mốc 2 OK, mốc 3 KHÔNG', () => {
    expect(kipDaoHanTietKiem(7, 2, 8)).toBe(true);
    expect(kipDaoHanTietKiem(7, 3, 8)).toBe(false);
    expect(mocKipCua(7, 8)).toEqual([2]);
    // Vòng 8 (ô cuối) thì không mốc nào kịp ⇒ ngân hàng đóng cửa.
    expect(mocKipCua(8, 8)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. MỞ hợp đồng — vector V8, V10, V12, V13', () => {
  it('V8 — vốn 10.000, vòng 1, mở 5.000 kỳ hạn 4 ô, lãi nền 400', () => {
    const r = apMoTietKiem(st(1, ghe(10000)), 'ban', [{ moc_bp: 5000, so_vong: 4 }]);
    expect(r.ok).toBe(true);
    const h = r.st.ghe[0]!.tiet_kiem![0]!;
    expect({ goc: h.goc, lai_bp: h.lai_bp, lai_don: h.lai_don, id: h.id })
      .toEqual({ goc: 5000, lai_bp: 275, lai_don: 0, id: 'tk1_0' });
    expect(r.st.ghe[0]!.von).toBe(5000);
    // Lãi mỗi ô = floor(5000 × 275 / 10000) = 137 (làm tròn XUỐNG — C5).
    expect(Math.floor((h.goc * h.lai_bp) / 10000)).toBe(137);
  });

  it('⭐ V10 — hai mốc CÙNG VÒNG áp TUẦN TỰ: mốc sau tính trên tiền còn lại', () => {
    const r = apMoTietKiem(st(1, ghe(10000)), 'ban',
      [{ moc_bp: 5000, so_vong: 2 }, { moc_bp: 5000, so_vong: 3 }]);
    expect(r.ok).toBe(true);
    const [a, b] = r.st.ghe[0]!.tiet_kiem!;
    expect({ goc: a!.goc, lai_bp: a!.lai_bp, id: a!.id })
      .toEqual({ goc: 5000, lai_bp: 250, id: 'tk1_0' });
    // 50% của 5.000 CÒN LẠI = 2.500, không phải 5.000.
    expect({ goc: b!.goc, lai_bp: b!.lai_bp, id: b!.id })
      .toEqual({ goc: 2500, lai_bp: 275, id: 'tk1_1' });
    expect(r.st.ghe[0]!.von).toBe(2500);
  });

  it('⭐ V12 — một kỳ hạn LẠ ⇒ CẢ CHUỖI bị bỏ, state không đổi', () => {
    const g0 = ghe(10000);
    const r = apMoTietKiem(st(1, g0), 'ban',
      [{ moc_bp: 5000, so_vong: 2 }, { moc_bp: 5000, so_vong: 9 }]);
    expect(r.loi).toBe('ky_han_la');
    expect(r.st.ghe[0]!.von).toBe(10000);
    expect(r.st.ghe[0]!.tiet_kiem ?? []).toEqual([]);
  });

  it('V13 — gốc quá nhỏ: tiền mặt 300, mốc 25% ⇒ 75 < 100 ⇒ từ chối', () => {
    const r = apMoTietKiem(st(1, ghe(300)), 'ban', [{ moc_bp: 2500, so_vong: 2 }]);
    expect(r.loi).toBe('goc_qua_nho');
    expect(r.st.ghe[0]!.von).toBe(300);
  });

  it('V11b — mốc không kịp đáo hạn bị từ chối bằng đúng mã lỗi của nó', () => {
    const r = apMoTietKiem(st(7, ghe(10000), 8), 'ban', [{ moc_bp: 5000, so_vong: 3 }]);
    expect(r.loi).toBe('khong_kip_dao_han');
  });

  it('cờ TẮT ⇒ `luat_tat`, không một chip nào đổi (song sinh)', () => {
    const r = apMoTietKiem(st(1, ghe(10000), 12, { ngan_hang: false }), 'ban',
      [{ moc_bp: 5000, so_vong: 2 }]);
    expect(r.loi).toBe('luat_tat');
    expect(r.st.ghe[0]!.von).toBe(10000);
  });

  it('quá nhiều lệnh trong một vòng ⇒ chặn ở lưới rác, không phải ở luật chơi', () => {
    const nhieu = Array.from({ length: TIET_KIEM.TRAN_MO_MOI_VONG + 1 },
      () => ({ moc_bp: 2500, so_vong: 2 }));
    expect(apMoTietKiem(st(1, ghe(100000)), 'ban', nhieu).loi).toBe('qua_nhieu_lenh');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. HUỶ — vector V9, V14', () => {
  /*
   * ⚠ `lai_bp: 350` là con số DỰNG TAY và cố ý KHÔNG bám bộ số đang chốt (mốc 4
   * hiện trả 275). Huỷ hợp đồng phải đúng với MỌI lãi suất đã chốt trong sổ —
   * kể cả hợp đồng mở dưới một bộ số cũ rồi replay lại. Buộc fixture này chạy
   * theo hằng số hiện hành là biến một bài về LOGIC HUỶ thành một bài về BẢNG
   * LÃI, và nó sẽ đỏ mỗi lần ai đó chỉnh lãi — đỏ mà không nói lên điều gì.
   * 350 bp trên gốc 5.000 = 175/ô, hai ô = 350 lãi treo: nội bộ vẫn nhất quán.
   */
  const coHopDong = (laiDon: number) => ghe(1000, {
    tiet_kiem: [{
      id: 'tk1_0', goc: 5000, vong_mo: 1, so_vong: 4, lai_bp: 350, lai_don: laiDon,
    }],
  });

  it('⭐ V9 — huỷ sau 2 lần cộng lãi: gốc về ví, 350 lãi treo MẤT SẠCH', () => {
    const g0 = coHopDong(350);
    const truoc = navCua(g0 as unknown as GheNav);
    const r = apHuyTietKiem(st(3, g0), 'ban', ['tk1_0']);
    expect(r.ok).toBe(true);
    const g1 = r.st.ghe[0]!;
    expect(g1.von).toBe(6000);
    expect(g1.tiet_kiem).toEqual([]);
    expect(g1.tk_su_kien_vong).toEqual([
      { vong: 3, id: 'tk1_0', goc: 5000, lai_mat: 350 },
    ]);
    // NAV tụt ĐÚNG BẰNG lãi treo — hình phạt là tiền thấy được, không phải chữ.
    expect(navCua(g1 as unknown as GheNav)).toBe(truoc - 350);
  });

  it('id không có ⇒ CẢ CHUỖI bị bỏ, state không đổi', () => {
    const g0 = coHopDong(350);
    const r = apHuyTietKiem(st(3, g0), 'ban', ['tk1_0', 'tk9_9']);
    expect(r.loi).toBe('khong_co_hop_dong');
    expect(r.st.ghe[0]!.von).toBe(1000);
    expect(r.st.ghe[0]!.tiet_kiem!.length).toBe(1);
  });

  it('⭐ V14 — ĐẦU HÀNG khi còn hợp đồng: gốc về ví, lãi treo mất', () => {
    const g1 = huyMoiHopDong(coHopDong(350), 5);
    expect(g1.von).toBe(6000);
    expect(g1.tiet_kiem).toEqual([]);
    expect(g1.tk_su_kien_vong![0]!.lai_mat).toBe(350);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. NAV — lãi treo là tài sản, tiền khoá không phải sức đóng', () => {
  const g = (): GheNav => ({
    von: 1000, vi_the: { btc: 2000 }, vi_the_khong: {},
    tiet_kiem: [{ goc: 5000, lai_don: 350 }],
  });

  it('⭐ `navCua` cộng CẢ gốc lẫn lãi treo — NAV mượt, không nhảy cục lúc đáo hạn', () => {
    expect(navCua(g())).toBe(1000 + 2000 + 5000 + 350);
  });

  it('⭐ `navTuDo` TRỪ phần đang khoá — sức đóng không được tính trên tiền rút không ra', () => {
    expect(navTuDo(g())).toBe(1000 + 2000);
  });

  it('ghế không có sổ thì hai thước bằng nhau — trận cũ không đổi một chip', () => {
    const x: GheNav = { von: 700, vi_the: { vang: 300 } };
    expect(navTuDo(x)).toBe(navCua(x));
    expect(navCua(x)).toBe(1000);
  });

  it('`tongTietKiem` đếm đúng gốc + lãi của mọi hợp đồng', () => {
    expect(tongTietKiem({
      tiet_kiem: [
        { id: 'a', goc: 100, vong_mo: 1, so_vong: 2, lai_bp: 0, lai_don: 5 },
        { id: 'b', goc: 200, vong_mo: 1, so_vong: 3, lai_bp: 0, lai_don: 7 },
      ],
    })).toBe(312);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. ⭐ BẤT BIẾN CẤU TRÚC — kết thúc tự nhiên không còn hợp đồng nào mở', () => {
  it('mọi mốc mở được ở mọi vòng đều đáo hạn TRONG bàn', () => {
    for (const soO of [8, 12, 16]) {
      for (let vong = 1; vong <= soO; vong += 1) {
        for (const n of mocKipCua(vong, soO)) {
          expect(vong + n - 1, `bàn ${soO} ô, mở ở vòng ${vong} kỳ hạn ${n}`)
            .toBeLessThanOrEqual(soO);
        }
      }
    }
  });

  it('`tatToanKhiDongTran` là NO-OP khi không ghế nào còn hợp đồng', () => {
    const s0 = st(12, ghe(5000));
    expect(tatToanKhiDongTran(s0)).toBe(s0);
  });

  it('trận ĐÓNG QUÁ HẠN còn hợp đồng ⇒ tất toán như huỷ, lãi treo mất', () => {
    const g0 = ghe(1000, {
      tiet_kiem: [{
        id: 'tk1_0', goc: 5000, vong_mo: 1, so_vong: 4, lai_bp: 350, lai_don: 525,
      }],
    });
    const sau = tatToanKhiDongTran(st(3, g0));
    expect(sau.ghe[0]!.von).toBe(6000);
    expect(sau.ghe[0]!.tiet_kiem).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. KHOÁ NẮM GIỮ TẮT — V16', () => {
  it('⭐ V16 — dưới v43 `apKhoaTaiSan` trả `co_che_tat` và KHÔNG đụng state', () => {
    const g0 = ghe(5000, { danh_muc: { tai_san: ['btc'], chien_thuat: [] } });
    const s0 = st(1, g0, 12, { khoa_tai_san_tat: true, luat_von: true });
    const r = apKhoaTaiSan(s0, 'ban', 'btc');
    expect(r.ok).toBe(false);
    expect(r.loi).toBe('co_che_tat');
    expect(r.st).toBe(s0);
  });

  it('dưới v42 (cờ tắt) cùng lệnh KHÔNG bị `co_che_tat` — song sinh', () => {
    const g0 = ghe(5000, { danh_muc: { tai_san: ['btc'], chien_thuat: [] } });
    const r = apKhoaTaiSan(st(1, g0, 12, { luat_von: true }), 'ban', 'btc');
    expect(r.loi).not.toBe('co_che_tat');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VII. Bảng luật — hai cờ v43', () => {
  const CO = ['khoaTaiSanTat', 'tietKiem'] as const;

  /*
   * D456 — TỪ v57 (dòng minigame) SỔ TIẾT KIỆM BỊ BỎ CÓ CHỦ ĐÍCH: `tietKiem` tắt ở mọi khoá ≥ v57 (founder 03/10: bỏ ngân
   * hàng, Đòn Bẩy NẠP THÊM thay chỗ). Vế đáng giữ của bài này là "khoá CŨ không đổi" — nên ngưỡng tính theo SỐ PHIÊN BẢN,
   * không liệt tên khoá: khoá v58+ lỡ bật lại sổ tiết kiệm thì bài VẪN đỏ (phải sửa ngưỡng có ý thức, kèm lý do).
   */
  const TU_V57_BO_SO_TIET_KIEM = 57;

  it('⭐ MỌI khoá < v43 tắt cả hai cờ — không trận cũ nào đổi kết quả', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const moi = soCua(ten) >= 43;
      for (const c of CO) {
        const mong = c === 'tietKiem' && soCua(ten) >= TU_V57_BO_SO_TIET_KIEM ? false : moi;
        expect((luat as unknown as Record<string, boolean>)[c], `"${ten}".${c}`).toBe(mong);
      }
    }
    for (const c of CO) expect(luatCua(null)[c], `null.${c}`).toBe(false);
  });

  it('v43 khác v42 ĐÚNG hai cờ đó', () => {
    const a = luatCua('balance-v42-taisan') as unknown as Record<string, boolean>;
    const b = luatCua(V43) as unknown as Record<string, boolean>;
    expect(Object.keys(b).filter((x) => a[x] !== b[x]).sort()).toEqual([...CO].sort());
  });

  it('⭐ mặc định prod mang ĐỦ hai cờ v43 — không bao giờ bật lẻ một cái', () => {
    /*
     * Bản đầu khẳng định "CHƯA lật" và đỏ đúng lúc lật (D317) — nó đã làm việc của nó:
     * mặc định không được đổi lặng lẽ. Giữ vế ĐÁNG GIÁ và bỏ vế ghim trạng thái, vì
     * một bài đỏ mỗi lần làm việc đúng là bài sẽ bị sửa cho qua rồi bị xoá.
     *
     * Vế đáng giá: HAI CỜ ĐI CÙNG NHAU, không bao giờ lẻ. Bật `tietKiem` mà quên
     * `khoaTaiSanTat` là bàn có cả hai cơ chế cam kết cùng lúc — người chơi học hai
     * luật cho một ý niệm, và cả UI lẫn Hướng dẫn đều đã viết theo giả định "chỉ một".
     * Bật `khoaTaiSanTat` mà quên `tietKiem` còn tệ hơn: giết một cơ chế, không thay
     * bằng gì, và cái ô trên bàn trống trơn.
     */
    /*
     * D525 — khoá mặc định v58 (khung minigame) BỎ sổ tiết kiệm có chủ đích (D456: Đòn Bẩy nạp thêm thay chỗ, "ô trên bàn" không còn) nhưng
     * GIỮ khoá tài sản tắt. Luật "đi cùng nhau" là của khoá có cơ chế cam kết trên bàn ⇒ áp cho khoá mặc định khi nó KHÔNG phải khung
     * minigame; khung minigame thì đòi đúng hình dạng D456.
     */
    const l = luatCua(HOLDEM_BALANCE_VERSION) as unknown as Record<string, boolean>;
    if (l.dongHoMinigame === true) {
      expect(l.tietKiem, 'khung minigame bỏ sổ tiết kiệm (D456)').toBe(false);
      return;
    }
    const bat = CO.filter((c) => l[c] === true);
    expect(bat.length === 0 || bat.length === CO.length,
      `hai cờ v43 phải cùng bật hoặc cùng tắt — đang bật: ${bat.join(', ')}`).toBe(true);
  });
});
