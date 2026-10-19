/**
 * THẺ NĂNG LỰC (D323) — vector chép tay, THUẦN (không DB, không engine).
 *
 * §I   `chamNangLucTran` — từng năng lực × từng bậc, vector chép tay (A5.2-style).
 * §II  `tinh_vao_the` / `ly_do_khong_tinh` — thứ tự ưu tiên khi nhiều lý do đúng.
 * §III `gopNangLuc` — test-retest (seed khác mới `chung_minh`), trận màn tập không tính.
 * §IV  BOT-SANITY — dãy vòng mô phỏng đúng khẩu vị của archetype đã có trong
 *      `server/holdem/bots.ts` (`tat_tay`/`da_dang` ở `BOT_CHOI_DUOC`,
 *      `tk_max`/`tk_huy` ở `BOT_NGAN_HANG`), KHÔNG chạy engine — chỉ mượn tên và
 *      khẩu vị đã biết để đặt tên vector cho dễ đọc.
 */
import { describe, expect, it } from 'vitest';
import { NANG_LUC_FORMULA_VERSION, NGUONG_NANG_LUC } from '../config/nang_luc.js';
import { chamNangLucTran, gopNangLuc, type DongNangLuc } from '../server/holdem/nang_luc.js';
import type { NangLucTran, TheNangLucTranDTO } from '../server/holdem/nang_luc_ids.js';
import { traiTran, type EventTho, type KhauViVong } from '../server/hanh_vi/trai.js';

const row = (o: Partial<DongNangLuc> = {}): DongNangLuc => ({
  vong: 1, brier: null, o_su_kien: false, la_tin_gia: false, tu_dong: false,
  so_ma: null, tien_mat_bp: null, tiet_kiem_bp: null, tk_huy_so: null, so_nhom: null,
  tran_xong: true, man_tap: false, nghi_may: false, ...o,
});

/** `n` dòng, mỗi dòng `vong` tăng dần từ 1, phần còn lại do `o(i)` (i = 0-based) quyết định. */
const nRows = (n: number, o: (i: number) => Partial<DongNangLuc>): DongNangLuc[] =>
  Array.from({ length: n }, (_, i) => row({ vong: i + 1, ...o(i) }));

const nangLuc = (the: TheNangLucTranDTO, id: string): NangLucTran =>
  the.nang_luc.find((n) => n.id === id)!;

/*
 * §0 — `so_nhom` ĐẾM NHÓM, KHÔNG ĐẾM MÃ (rà 13/09, cửa sổ chính). Bốn bài trên
 * nhận `so_nhom` đã có sẵn nên chưa ai canh chính phép đếm trong `trai.ts`:
 * nếu `demSoNhom` lỡ đếm theo `id` thay vì `nhom`, tat_tay (btc + cp_cn, cùng
 * phe rủi ro) ra "2" và đạt phân tán — đúng cái bẫy migration 0064 sinh ra để
 * chặn — mà §IV vẫn xanh vì nó tự bơm `so_nhom`.
 */
describe('§0 — traiTran.so_nhom: đếm NHÓM tài sản từ chain, null ≠ 0', () => {
  const MAP = { o: [{ kind: 'nen' }, { kind: 'nen' }, { kind: 'nen' }, { kind: 'nen' }] };
  const CO = { tran_xong: true, man_tap: false, la_khach: false };
  const camKet = (vong: number): EventTho =>
    ({ ts: new Date(1000 * vong), action_type: 'hd_cam_ket', num: null, value_json: { vong } });
  const chot = (vong: number, chain: unknown): EventTho =>
    ({ ts: new Date(1000 * vong + 2), action_type: 'hd_chot_phien', num: 0,
       value_json: { vong, chain } });
  const kv = (vong: number, so_ma: number): KhauViVong =>
    ({ vong, tien_mat_bp: 3000, so_ma, thay_o_do: null, tiet_kiem_bp: null });
  const ts = (id: string) => ({ kind: 'tai_san', id, delta_bp: 10, giai_doan: 'nen', cap: 0 });

  it('⭐ hai mã CÙNG phe ⇒ 1 · hai mã KHÁC phe ⇒ 2 · chain rỗng ⇒ 0 · không chốt phiên ⇒ null', () => {
    const d = traiTran('m', MAP, [
      camKet(1), chot(1, [ts('btc'), ts('cp_cn')]),      // cả hai `rui_ro`
      camKet(2), chot(2, [ts('vn30'), ts('vang')]),      // rủi ro + phòng thủ
      camKet(3), chot(3, []),                            // có chuỗi, không cầm mã nào
      camKet(4),                                         // không có hd_chot_phien
    ], [kv(1, 2), kv(2, 2), kv(3, 0), kv(4, 0)], CO);
    expect(d.map((x) => x.so_nhom)).toEqual([1, 2, 0, null]);
  });

  it('mắt xích không phải tai_san (echo · nhan · crowding) và mã lạ KHÔNG được đếm', () => {
    const d = traiTran('m', MAP, [
      camKet(1), chot(1, [
        { kind: 'echo', id: 'btc', su_kien: 'ha_lai_suat', delta_bp: 5 },
        { kind: 'nhan', id: 'don_bay', he_so_bp: 200, delta_bp: 3 },
        { kind: 'crowding', id: 'vn30', delta_bp: -4, so_nguoi_dong: 3 },
        ts('ma_khong_ton_tai'),
      ]),
    ], [kv(1, 1)], CO);
    expect(d[0]!.so_nhom).toBe(0);
  });
});

describe('chamNangLucTran — cam_ket_tiet_kiem (N1)', () => {
  it('⭐ chua_gap khi LUẬT KHÔNG CÓ cơ chế (tiet_kiem_bp null toàn bộ)', () => {
    const n1 = nangLuc(chamNangLucTran(nRows(3, () => ({}))), 'cam_ket_tiet_kiem');
    expect(n1.bac).toBe('chua_gap');
    expect(n1.bang_chung).toEqual({ so_vong_gui: null, so_huy: null, ty_trong_max_bp: null });
  });

  it('⭐ KHÁC chua_gap khi CÓ CỬA mà không gửi — cùng tên bậc, bang_chung khác hẳn', () => {
    const n1 = nangLuc(
      chamNangLucTran(nRows(3, () => ({ tiet_kiem_bp: 0, tk_huy_so: 0 }))), 'cam_ket_tiet_kiem');
    expect(n1.bac).toBe('chua_gap');
    expect(n1.bang_chung).toEqual({ so_vong_gui: 0, so_huy: 0, ty_trong_max_bp: 0 });
  });

  it('gap_chua_vung khi có huỷ trước hạn (tk_huy_so tổng > 0), ghi vong_huy_dau', () => {
    const the = chamNangLucTran([
      row({ vong: 1, tiet_kiem_bp: 4000, tk_huy_so: 0 }),
      row({ vong: 2, tiet_kiem_bp: 0, tk_huy_so: 2 }),
      row({ vong: 3, tiet_kiem_bp: 3000, tk_huy_so: 0 }),
    ]);
    const n1 = nangLuc(the, 'cam_ket_tiet_kiem');
    expect(n1.bac).toBe('gap_chua_vung');
    expect(n1.bang_chung).toEqual({ so_vong_gui: 2, so_huy: 2, ty_trong_max_bp: 4000, vong_huy_dau: 2 });
  });

  it('lam_duoc khi gửi mà không huỷ lần nào', () => {
    const the = chamNangLucTran([
      row({ vong: 1, tiet_kiem_bp: 4000, tk_huy_so: 0 }),
      row({ vong: 2, tiet_kiem_bp: 4000, tk_huy_so: 0 }),
    ]);
    const n1 = nangLuc(the, 'cam_ket_tiet_kiem');
    expect(n1.bac).toBe('lam_duoc');
    expect(n1.bang_chung).toEqual({ so_vong_gui: 2, so_huy: 0, ty_trong_max_bp: 4000 });
  });
});

describe('chamNangLucTran — doc_tin (N2)', () => {
  it('chua_gap khi n < N_BRIER_TOI_THIEU dù đủ sự kiện — vẫn trả số đếm được thật', () => {
    const the = chamNangLucTran([
      row({ vong: 1, brier: 0.3, o_su_kien: true }),
      row({ vong: 2, brier: 0.3, o_su_kien: true }),
    ]);
    const n2 = nangLuc(the, 'doc_tin');
    expect(n2.bac).toBe('chua_gap');
    expect(n2.bang_chung).toEqual({ brier_tb: 0.3, n: 2, so_su_kien: 2, so_tin_gia: 0 });
  });

  it('chua_gap khi so_su_kien < SU_KIEN_TOI_THIEU dù n đủ — brier_tb vẫn KHÔNG null', () => {
    const the = chamNangLucTran([
      row({ vong: 1, brier: 0.2, o_su_kien: true }),
      row({ vong: 2, brier: 0.2, o_su_kien: false }),
      row({ vong: 3, brier: 0.2, o_su_kien: false }),
      row({ vong: 4, brier: 0.2, o_su_kien: false }),
    ]);
    const n2 = nangLuc(the, 'doc_tin');
    expect(n2.bac).toBe('chua_gap');
    expect(n2.bang_chung).toEqual({ brier_tb: 0.2, n: 4, so_su_kien: 1, so_tin_gia: 0 });
  });

  it('⭐ n = 0 ⇒ CHỈ brier_tb null; n/so_su_kien/so_tin_gia vẫn là số đếm thật', () => {
    const the = chamNangLucTran(nRows(2, () => ({ o_su_kien: true, la_tin_gia: true })));
    const n2 = nangLuc(the, 'doc_tin');
    expect(n2.bac).toBe('chua_gap');
    expect(n2.bang_chung).toEqual({ brier_tb: null, n: 0, so_su_kien: 2, so_tin_gia: 2 });
  });

  it('lam_duoc khi đủ mẫu và brier_tb < ngưỡng (BAC_DOC.DANG_HOC của insight.ts)', () => {
    const the = chamNangLucTran(nRows(4, (i) => ({ brier: 0.4, o_su_kien: i < 2 })));
    const n2 = nangLuc(the, 'doc_tin');
    expect(n2.bac).toBe('lam_duoc');
    expect(n2.bang_chung).toEqual({ brier_tb: 0.4, n: 4, so_su_kien: 2, so_tin_gia: 0 });
  });

  it('gap_chua_vung khi đủ mẫu mà brier_tb ≥ ngưỡng', () => {
    const the = chamNangLucTran(nRows(4, (i) => ({ brier: 1.0, o_su_kien: i < 2 })));
    expect(nangLuc(the, 'doc_tin').bac).toBe('gap_chua_vung');
  });

  it('biên: brier_tb ĐÚNG BẰNG ngưỡng ⇒ gap_chua_vung ("< " mới lam_duoc, không phải "≤")', () => {
    const nguong = NGUONG_NANG_LUC.DOC_TIN.BRIER_LAM_DUOC;
    const the = chamNangLucTran(nRows(4, (i) => ({ brier: nguong, o_su_kien: i < 2 })));
    expect(nangLuc(the, 'doc_tin').bac).toBe('gap_chua_vung');
  });
});

/*
 * D436 (founder 27/09: "Chỉ tách LỌC TIN") — trận chạy luật có hệ trait (v55: `trait_json` khác null, kể cả mảng rỗng)
 * KHÔNG vào thẻ đọc tin; GIỮ SỔ và CHIA vẫn chấm như cũ. Tiêm lỗi: bỏ nhánh `tach_luat_trait` ⇒ bài đầu đỏ.
 */
describe('D436 — trận có hệ trait tách khỏi LỌC TIN', () => {
  const du = (trait: string[] | null) => nRows(6, (i) => ({
    brier: 0.1, o_su_kien: i < 3, trait_json: trait, tiet_kiem_bp: 2000, tk_huy_so: 0, so_ma: 2, so_nhom: 2,
  }));

  it('trận v55 (trait rỗng) ⇒ LỌC TIN chua_gap kèm dấu tách; GIỮ SỔ + CHIA vẫn lam_duoc', () => {
    const the = chamNangLucTran(du([]));
    expect(nangLuc(the, 'doc_tin').bac).toBe('chua_gap');
    expect(nangLuc(the, 'doc_tin').bang_chung).toMatchObject({ tach_luat_trait: 1, n: 6 });
    expect(nangLuc(the, 'cam_ket_tiet_kiem').bac).toBe('lam_duoc');
    expect(nangLuc(the, 'phan_tan').bac).toBe('lam_duoc');
  });

  it('vế ngược — cùng dữ liệu ở trận cũ (trait null) ⇒ LỌC TIN chấm bình thường (lam_duoc), không dấu tách', () => {
    const the = chamNangLucTran(du(null));
    expect(nangLuc(the, 'doc_tin').bac).toBe('lam_duoc');
    expect(nangLuc(the, 'doc_tin').bang_chung).not.toHaveProperty('tach_luat_trait');
  });

  it('gộp theo người: trận v55 không thành một đề LỌC TIN, nhưng vẫn là một đề GIỮ SỔ', () => {
    const tran = [{ seed: 1, luc: '2026-09-27', the: chamNangLucTran(du(['noi_gian'])) }];
    const g = gopNangLuc(tran);
    expect(g.nang_luc.find((n) => n.id === 'doc_tin')!.so_de_gap).toBe(0);
    expect(g.nang_luc.find((n) => n.id === 'cam_ket_tiet_kiem')!.so_de_gap).toBe(1);
  });
});

describe('chamNangLucTran — phan_tan (N3)', () => {
  it('chua_gap khi vòng có vị thế < VONG_VI_THE_TOI_THIEU', () => {
    const the = chamNangLucTran(nRows(2, () => ({ so_ma: 1, so_nhom: 1 })));
    const n3 = nangLuc(the, 'phan_tan');
    expect(n3.bac).toBe('chua_gap');
    expect(n3.bang_chung.so_vong_vi_the).toBe(2);
  });

  it('vòng tu_dong (hết giờ tự nộp) KHÔNG tính là vòng có vị thế', () => {
    const the = chamNangLucTran([
      row({ vong: 1, so_ma: 2, so_nhom: 2, tu_dong: true }),
      row({ vong: 2, so_ma: 2, so_nhom: 2 }),
      row({ vong: 3, so_ma: 2, so_nhom: 2 }),
    ]);
    const n3 = nangLuc(the, 'phan_tan');
    expect(n3.bang_chung.so_vong_vi_the).toBe(2); // vòng 1 bị loại
    expect(n3.bac).toBe('chua_gap'); // 2 < ngưỡng 3
  });

  it('dự phòng khi so_nhom vắng: dùng so_ma ≥ 2, đánh dấu dung_du_phong = 1', () => {
    const the = chamNangLucTran(nRows(4, () => ({ so_ma: 2, so_nhom: null })));
    const n3 = nangLuc(the, 'phan_tan');
    expect(n3.bang_chung.dung_du_phong).toBe(1);
    expect(n3.bac).toBe('lam_duoc');
  });
});

describe('chamNangLucTran — tinh_vao_the & ly_do_khong_tinh (thứ tự ưu tiên cố định)', () => {
  it('rows rỗng ⇒ false, chua_xong', () => {
    const the = chamNangLucTran([]);
    expect(the.tinh_vao_the).toBe(false);
    expect(the.ly_do_khong_tinh).toBe('chua_xong');
  });

  it('⭐ có vòng chưa xong ⇒ chua_xong THẮNG, kể cả khi cũng có man_tap', () => {
    const the = chamNangLucTran([row({ tran_xong: false, man_tap: true }), row({ tran_xong: true })]);
    expect(the.tinh_vao_the).toBe(false);
    expect(the.ly_do_khong_tinh).toBe('chua_xong');
  });

  it('màn tập (đã xong hết) ⇒ man_tap', () => {
    const the = chamNangLucTran([row({ tran_xong: true, man_tap: true })]);
    expect(the.tinh_vao_the).toBe(false);
    expect(the.ly_do_khong_tinh).toBe('man_tap');
  });

  it('nghi máy (đã xong, không màn tập) ⇒ nghi_may', () => {
    const the = chamNangLucTran([row({ tran_xong: true, man_tap: false, nghi_may: true })]);
    expect(the.tinh_vao_the).toBe(false);
    expect(the.ly_do_khong_tinh).toBe('nghi_may');
  });

  it('xong, không màn tập, không nghi máy ⇒ tính vào thẻ', () => {
    const the = chamNangLucTran([row({ tran_xong: true, man_tap: false, nghi_may: false })]);
    expect(the.tinh_vao_the).toBe(true);
    expect(the.ly_do_khong_tinh).toBeNull();
  });

  it('formula_version khớp config (một nguồn, không chép số)', () => {
    expect(chamNangLucTran([row()]).formula_version).toBe(NANG_LUC_FORMULA_VERSION);
  });
});

describe('gopNangLuc — test-retest: seed khác mới chung_minh', () => {
  const camKetLamDuoc = { tiet_kiem_bp: 4000, tk_huy_so: 0 };
  const doTran = (seed: number, luc: string | null, over: Partial<DongNangLuc> = {}) => ({
    seed, luc,
    the: chamNangLucTran([row({ tran_xong: true, man_tap: false, nghi_may: false, ...over })]),
  });

  it('2 trận lam_duoc CÙNG seed ⇒ lam_duoc (không chung_minh) — chơi lại không tính thêm đề', () => {
    const dto = gopNangLuc([
      doTran(111, '2026-01-01T00:00:00.000Z', camKetLamDuoc),
      doTran(111, '2026-01-02T00:00:00.000Z', camKetLamDuoc),
    ]);
    const n1 = dto.nang_luc.find((n) => n.id === 'cam_ket_tiet_kiem')!;
    expect(n1.bac).toBe('lam_duoc');
    expect(n1.so_de_lam_duoc).toBe(1);
    expect(n1.so_de_gap).toBe(2);
    expect(n1.lan_dau_lam_duoc).toBe('2026-01-01T00:00:00.000Z');
  });

  it('⭐ 2 trận lam_duoc ở 2 SEED KHÁC NHAU ⇒ chung_minh', () => {
    const dto = gopNangLuc([
      doTran(111, '2026-01-02T00:00:00.000Z', camKetLamDuoc),
      doTran(222, '2026-01-01T00:00:00.000Z', camKetLamDuoc), // cố ý luc sớm hơn, đứng sau trong mảng
    ]);
    const n1 = dto.nang_luc.find((n) => n.id === 'cam_ket_tiet_kiem')!;
    expect(n1.bac).toBe('chung_minh');
    expect(n1.so_de_lam_duoc).toBe(2);
    // lan_dau_lam_duoc = luc NHỎ NHẤT trong các trận lam_duoc, không phải trận ĐẦU MẢNG.
    expect(n1.lan_dau_lam_duoc).toBe('2026-01-01T00:00:00.000Z');
  });

  it('⭐ trận màn tập không tính, dù chấm ra lam_duoc trên chính trận đó', () => {
    const tapThe = chamNangLucTran([row({ tran_xong: true, man_tap: true, ...camKetLamDuoc })]);
    expect(tapThe.tinh_vao_the, 'sanity: man_tap luôn bị loại khỏi thẻ').toBe(false);
    const dto = gopNangLuc([{ seed: 999, luc: '2026-01-01T00:00:00.000Z', the: tapThe }]);
    expect(dto.so_de).toBe(0);
    for (const n of dto.nang_luc) {
      expect(n.bac).toBe('chua_gap');
      expect(n.so_de_gap).toBe(0);
      expect(n.so_de_lam_duoc).toBe(0);
    }
  });
});

/*
 * ─── BOT-SANITY ─────────────────────────────────────────────────────────────
 * Không chạy engine/bot thật — chỉ mượn KHẨU VỊ đã biết của bốn archetype để
 * dựng vector tay có tên dễ tra: `tat_tay`/`da_dang` (`BOT_CHOI_DUOC`, giỏ tài
 * sản CÙNG PHE với `tat_tay` — btc+cp_cn đều `rui_ro` — và KHÁC PHE với
 * `da_dang` — vn30 `rui_ro` + vàng/usd `phong_thu`) và `tk_max`/`tk_huy`
 * (`BOT_NGAN_HANG`, xem `server/holdem/bots.ts`).
 */
describe('bot-sanity — vector đặt tên theo archetype đã có trong bots.ts', () => {
  it('tat_tay (giỏ btc+cp_cn — cùng nhóm rui_ro) ⇒ phan_tan gap_chua_vung', () => {
    const the = chamNangLucTran(nRows(8, () => ({ so_ma: 2, so_nhom: 1 })));
    expect(nangLuc(the, 'phan_tan').bac).toBe('gap_chua_vung');
  });

  it('da_dang (giỏ vn30+vàng/usd — trải hai nhóm) ⇒ phan_tan lam_duoc', () => {
    const the = chamNangLucTran(nRows(8, () => ({ so_ma: 2, so_nhom: 2 })));
    expect(nangLuc(the, 'phan_tan').bac).toBe('lam_duoc');
  });

  it('tk_huy ("gửi rồi huỷ khi ô thật tốt") ⇒ cam_ket_tiet_kiem gap_chua_vung', () => {
    const the = chamNangLucTran(nRows(8, (i) => ({
      tiet_kiem_bp: i === 3 ? 0 : 10000, tk_huy_so: i === 3 ? 1 : 0,
    })));
    expect(nangLuc(the, 'cam_ket_tiet_kiem').bac).toBe('gap_chua_vung');
  });

  it('tk_max ("gửi hết, không bao giờ huỷ") ⇒ cam_ket_tiet_kiem lam_duoc', () => {
    const the = chamNangLucTran(nRows(8, () => ({ tiet_kiem_bp: 10000, tk_huy_so: 0 })));
    expect(nangLuc(the, 'cam_ket_tiet_kiem').bac).toBe('lam_duoc');
  });
});
