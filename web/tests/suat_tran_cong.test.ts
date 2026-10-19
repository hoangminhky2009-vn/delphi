/**
 * LUẬT SUẤT TRẬN — `web/worker/suat.js` (SPEC `docs/spec/tran-tran-ngay.md` mục 5).
 *
 * Khoá những tính chất mà một hàng chờ SAI vẫn "chạy được":
 *   1. quỹ theo GIỜ VN, suất thừa CỘNG DỒN trong ngày — không làm tròn rơi suất
 *   2. FIFO thật: KHÔNG CHEN HÀNG, hỏi lại không tụt hạng, im quá hạn thì rời hàng
 *   3. đếm bằng 201 THẬT: lỗi trả suất, 201 không có suất giữ vẫn đếm
 *   4. hết quỹ NGÀY nói thật "mở lại 0:00", qua 0:00 người chờ đêm qua đứng đầu
 */
import { describe, expect, it } from 'vitest';
import { SUAT_TRAN, dauGioVN, moLaiLuc, quyLuyKe } from '../../config/suat_tran';
import { baoKetQua, conLai, soSuatTrong, thongKe, xinSuat } from '../worker/suat.js';

/** Cấu hình đếm tay được: 24 suất/ngày, mỗi giờ một suất ⇒ quỹ luỹ kế tới hết giờ h = h + 1. */
const CH = { ...SUAT_TRAN, QUY_NGAY: 24, TRONG_SO_GIO: Array(24).fill(1) as readonly number[] };

/** Mốc UTC của HH:MM giờ VN ngày 12/10/2026. */
const vn = (gio: number, phut = 0) => Date.UTC(2026, 9, 12, gio - 7, phut);

function cho(kq: ReturnType<typeof xinSuat>) {
  if (kq.vao) throw new Error('mong đợi đang chờ, nhưng đã được nhả suất');
  return kq;
}

/** Xin rồi báo 201 — một trận tạo thật. */
function choi(st: ReturnType<typeof soSuatTrong>, ve: string, now: number) {
  expect(xinSuat(st, ve, now, CH).vao).toBe(true);
  baoKetQua(st, ve, true, now);
}

describe('quỹ theo giờ VN, cộng dồn trong ngày', () => {
  it('quỹ luỹ kế giờ 23 = ĐÚNG quỹ ngày ở bảng thật (luỹ kế rồi mới làm tròn — không rơi suất)', () => {
    expect(SUAT_TRAN.TRONG_SO_GIO).toHaveLength(24);
    expect(quyLuyKe(23)).toBe(SUAT_TRAN.QUY_NGAY);
    for (let h = 1; h <= 23; h += 1) expect(quyLuyKe(h)).toBeGreaterThanOrEqual(quyLuyKe(h - 1));
  });

  it('lưới server không bao giờ chặt hơn cửa chính (trần server ≥ quỹ ngày)', () => {
    expect(SUAT_TRAN.TRAN_NGAY_SERVER).toBeGreaterThanOrEqual(SUAT_TRAN.QUY_NGAY);
  });

  it('không ai chơi 0h–9h ⇒ 10h có 11 suất dồn lại', () => {
    const st = soSuatTrong();
    expect(conLai(st, vn(10, 5), CH)).toBe(11);
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10, 5));
    expect(cho(xinSuat(st, 'tre', vn(10, 6), CH)).vi_tri).toBe(1);
  });

  it('hết suất giờ này ⇒ số thứ tự + giờ dự kiến = đầu giờ sau (giờ VN)', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10));
    const a = cho(xinSuat(st, 'a', vn(10, 20), CH));
    const b = cho(xinSuat(st, 'b', vn(10, 21), CH));
    expect([a.vi_tri, a.tong, a.du_kien, a.het_ngay]).toEqual([1, 1, dauGioVN(vn(10), 11), false]);
    expect([b.vi_tri, b.tong, b.du_kien]).toEqual([2, 2, dauGioVN(vn(10), 12)]);
    // Sang giờ mới ⇒ người đầu hàng tự được nhả (client chỉ việc hỏi lại).
    expect(xinSuat(st, 'a', vn(11, 0), CH).vao).toBe(true);
    expect(xinSuat(st, 'b', vn(11, 0), CH).vao).toBe(false);
  });
});

describe('FIFO thật', () => {
  it('⭐ KHÔNG CHEN HÀNG: giờ mới có suất, người mới tới không lấp được suất của người đang chờ chưa kịp hỏi', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10));
    cho(xinSuat(st, 'cu', vn(10, 59), CH)); // được bảo hỏi lại sau 15 s, còn trong ân hạn lúc 11:00
    // 11:00 có đúng 1 suất mới; 'cu' chưa hỏi lại, 'moi' tới trước.
    const kq = cho(xinSuat(st, 'moi', vn(11, 0), CH));
    expect(kq.vi_tri).toBe(2);
    expect(xinSuat(st, 'cu', vn(11, 0) + 30_000, CH).vao).toBe(true);
  });

  it('hỏi lại KHÔNG làm tụt hạng', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10));
    cho(xinSuat(st, 'a', vn(10, 10), CH));
    cho(xinSuat(st, 'b', vn(10, 10), CH));
    expect(cho(xinSuat(st, 'a', vn(10, 11), CH)).vi_tri).toBe(1);
    expect(cho(xinSuat(st, 'b', vn(10, 11), CH)).vi_tri).toBe(2);
  });

  it('im quá nhịp đã bảo + ân hạn ⇒ rời hàng, người sau nhích lên', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10));
    const a = cho(xinSuat(st, 'a', vn(10, 10), CH));
    cho(xinSuat(st, 'b', vn(10, 10), CH));
    const hanA = vn(10, 10) + a.hoi_lai_s * 1000 + CH.AN_HAN_CHO_MS;
    // b vẫn hỏi đều; a im.
    cho(xinSuat(st, 'b', vn(10, 14), CH));
    expect(cho(xinSuat(st, 'b', hanA + 1, CH)).vi_tri).toBe(1);
  });

  it('nhịp hỏi kẹp trong [MIN, MAX]: xa giờ dự kiến thì thưa, sát thì dày', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10));
    expect(cho(xinSuat(st, 'xa', vn(10, 1), CH)).hoi_lai_s).toBe(CH.HOI_LAI_MAX_S);
    const st2 = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st2, `v${k}`, vn(10));
    expect(cho(xinSuat(st2, 'gan', vn(10, 59), CH)).hoi_lai_s).toBe(15);
  });
});

describe('đếm bằng 201 thật', () => {
  it('suất đang GIỮ tính vào đã tiêu ⇒ hai người không cùng ăn một suất', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 10; k += 1) choi(st, `v${k}`, vn(10));
    expect(xinSuat(st, 'a', vn(10, 1), CH).vao).toBe(true); // giữ suất cuối, Vercel chưa trả
    expect(xinSuat(st, 'b', vn(10, 1), CH).vao).toBe(false);
  });

  it('Vercel lỗi ⇒ trả suất về quỹ, người kế được nhả', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 10; k += 1) choi(st, `v${k}`, vn(10));
    xinSuat(st, 'a', vn(10, 1), CH);
    cho(xinSuat(st, 'b', vn(10, 1), CH));
    baoKetQua(st, 'a', false, vn(10, 2));
    expect(st.daDung).toBe(10);
    expect(xinSuat(st, 'b', vn(10, 2), CH).vao).toBe(true);
  });

  it('Worker chết sau khi xin ⇒ suất giữ hết hạn tự về quỹ', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 10; k += 1) choi(st, `v${k}`, vn(10));
    xinSuat(st, 'a', vn(10, 1), CH);
    expect(xinSuat(st, 'b', vn(10, 1) + CH.HAN_GIU_MS + 1, CH).vao).toBe(true);
  });

  it('201 không có suất giữ VẪN đếm (trận đã tạo là đã đốt GB-giờ)', () => {
    const st = soSuatTrong();
    baoKetQua(st, 'ma', true, vn(10));
    expect(st.daDung).toBe(1);
  });
});

describe('hết quỹ ngày', () => {
  it('vị trí vượt quỹ còn lại của ngày ⇒ nói thật: hết suất hôm nay, mở lại 0:00 VN', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 24; k += 1) choi(st, `v${k}`, vn(23));
    const kq = cho(xinSuat(st, 'muon', vn(23, 30), CH));
    expect(kq.het_ngay).toBe(true);
    expect(kq.du_kien).toBeNull();
    expect(kq.mo_lai_luc).toBe(moLaiLuc(vn(23, 30)));
    expect(new Date(kq.mo_lai_luc).getUTCHours()).toBe(17); // 0:00 giờ VN = 17:00 UTC hôm trước
  });

  it('qua 0:00 VN ⇒ quỹ mới, người đứng chờ đêm qua ĐẦU HÀNG sáng nay', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 24; k += 1) choi(st, `v${k}`, vn(23));
    cho(xinSuat(st, 'dem', vn(23, 59), CH));
    const sang = vn(23, 59) + 70_000; // 0:00:10 ngày 13/10
    cho(xinSuat(st, 'som', sang, CH));
    // 0h có đúng 1 suất (cấu hình đếm tay) ⇒ thuộc về người chờ từ đêm qua.
    expect(xinSuat(st, 'dem', sang + 10_000, CH).vao).toBe(true);
    expect(st.daDung).toBe(0);
  });
});

describe('/admin thấy được', () => {
  it('thống kê: giờ này x / quỹ giờ · hôm nay y / quỹ ngày · đang chờ z', () => {
    const st = soSuatTrong();
    for (let k = 0; k < 11; k += 1) choi(st, `v${k}`, vn(10));
    cho(xinSuat(st, 'a', vn(10, 30), CH));
    expect(thongKe(st, vn(10, 31), CH)).toMatchObject({
      gio_vn: 10, dung_gio_nay: 11, quy_gio: 1, con_lai: 0, da_dung: 11, quy_ngay: 24, dang_cho: 1,
    });
  });
});
