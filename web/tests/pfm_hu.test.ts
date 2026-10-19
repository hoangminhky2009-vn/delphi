/**
 * PFM — HŨ & MỤC TIÊU (nhóm C). D191.
 *
 * Bốn khối, xếp theo ĐỘ ĐẮT KHI HỎNG:
 *   §I   CỬA NGỮ NGHĨA — thứ duy nhất được rời máy. Hỏng = rò tiền/chữ tự do lên
 *        server, và đó là CỬA MỘT CHIỀU (P2 🔒): đã rò thì đã rò.
 *   §II  MÁY TRẠNG THÁI — tạm dừng ≠ bỏ dở, và mở lại được (C8, founder 30/08).
 *   §III TỰ TẠO + MẪU — hai đường vào, cả hai hợp lệ (founder 31/08 + P14).
 *   §IV  ĐỌC ĐỂ NHÌN — tiến độ null≠0, xếp thứ tự.
 */
import { describe, expect, it } from 'vitest';
import {
  tuTao, tuMau, sua, doiTrangThai, quyetToan, resetGop, chuyenDuoc, tienDo, nhanNguNghia,
  sapXep, LoiHu, LOAI_HU, HAN_HU, UU_TIEN_HU, KET_QUA_HU, CHUYEN_TIEP, ICON_MAC_DINH, type Hu,
} from '../src/pfm/hu.js';
import { SO_DANG_KY } from '@config/pfm_dac_trung';
import { MAU_HU, ICON_HU, mauHopVoiHoSo } from '../src/pfm/hu_mau.js';
import { TU_KE_DON } from '../src/lib/khoanh_khac';

const LUC = '2026-08-31T10:00:00.000Z';
/** Hũ mặc định của test: CHỈ CÓ TÊN — đúng đường user hay đi nhất. */
const co = (v: Partial<Parameters<typeof tuTao>[0]> = {}, id = 'h1'): Hu => tuTao({
  ten: 'Quỹ dự phòng', ...v,
}, LUC, id);

describe('§I — CỬA NGỮ NGHĨA: thứ duy nhất được rời máy (P2 🔒)', () => {
  it('⭐ không rò TÊN TỰ DO — kể cả tên trông như dữ liệu', () => {
    // Hũ ĐẦY ĐỦ NHÃN, cố ý: đây là ca mà cửa chở NHIỀU NHẤT, nên nó khoá được trọn
    // danh sách trường. Ca không nhãn có bài riêng ngay dưới.
    const h = co({
      ten: 'Đám cưới con Hường 25 triệu', ghiChu: 'bí mật của tôi',
      loai: 'su_kien', han: 'vua', uuTien: 'cao', thietYeu: false,
    });
    const ra = nhanNguNghia(h);
    const s = JSON.stringify(ra);
    expect(s).not.toContain('Hường');
    expect(s).not.toContain('bí mật');
    expect(Object.keys(ra).sort()).toEqual([
      'so_lan_sua_muc', 'trang_thai', 'tu_mau',
      'y_han', 'y_loai', 'y_thiet_yeu', 'y_uu_tien',
    ]);
  });

  it('⭐ không rò SỐ TIỀN — kể cả mức user tự đặt', () => {
    const h = co({ muc: 25_000_000 });
    expect(JSON.stringify(nhanNguNghia(h))).not.toContain('25000000');
    // và không một giá trị SỐ nào ngoài bộ đếm lần-sửa-mức
    const so = Object.entries(nhanNguNghia(h))
      .filter(([, v]) => typeof v === 'number').map(([k]) => k);
    expect(so).toEqual(['so_lan_sua_muc']);
  });

  it('⭐⭐ hũ KHÔNG CẤT `daGop` — "đã góp" luôn TÍNH từ sổ (D61)', () => {
    /*
     * Một con số `daGop` nằm sẵn trên hũ là bản cài đặt THỨ HAI của "tổng khoản nối vào
     * hũ này", và nó trôi ở ba chỗ không ai nhớ: xoá một khoản · sửa số tiền một khoản ·
     * khôi phục két đè lát tháng (K8). Cú trôi biểu hiện là **hũ nói 3 triệu trong khi
     * sổ cộng ra 2,8 triệu** — một lời nói dối về tiền của chính user, thứ họ sẽ bắt
     * được và sau đó không tin con số nào của app nữa.
     * ⇒ Khoá bằng HÌNH DẠNG, không bằng lời hứa: trường không tồn tại thì không ai ghi
     *   vào nó được, kể cả "cho tiện".
     */
    expect(co({ muc: 1000 })).not.toHaveProperty('daGop');
    expect(tienDo.length, '`tienDo` phải ĐƯỢC ĐƯA số đã góp, không tự đọc').toBe(2);
  });

  it('⭐⭐ `mocGop` (mốc RESET) là RIÊNG TƯ — không lọt qua cửa ngữ nghĩa', () => {
    /*
     * Một mốc giờ chính xác tới mili-giây là dấu vân tay hành vi, và nó đứng chung hàng với
     * `muc` trong `Hu`. Cửa `nhanNguNghia()` liệt kê từng trường nên trường mới MẶC ĐỊNH ở
     * lại — bài này chứng minh điều đó cho ĐÚNG trường này, bằng cả giá trị lẫn danh sách
     * khoá (một `moc_gop: null` cũng là rò: nó nói "người này chưa reset").
     */
    const moc = '2026-09-07T03:04:05.678Z';
    const h = resetGop(co({ muc: 1000 }), moc);
    expect(h.mocGop).toBe(moc);
    const ra = nhanNguNghia(h);
    const s = JSON.stringify(ra);
    expect(s).not.toContain(moc);
    expect(s).not.toContain('2026-09-07');
    expect(s.toLowerCase()).not.toContain('moc');
    expect(Object.keys(ra).sort()).toEqual(['so_lan_sua_muc', 'trang_thai', 'tu_mau']);
  });

  it('chỉ chở HƯỚNG sửa mức, không chở số', () => {
    let h = co({ muc: 1_000_000 });
    h = sua(h, { muc: 3_000_000 }, LUC);   // tăng
    h = sua(h, { muc: 2_000_000 }, LUC);   // giảm
    expect(h.lichSu.map((d) => d.ma))
      .toEqual(['tao', 'sua_muc_tang', 'sua_muc_giam']);
    expect(nhanNguNghia(h).so_lan_sua_muc).toBe(2);
    expect(JSON.stringify(h.lichSu)).not.toContain('3000000');
  });

  it('⭐ BỎ MỨC (null) không phải HẠ MỨC — không ghi dấu hướng nào (R10)', () => {
    /*
     * Bản cũ viết `const moi = thay.muc ?? 0`, nên "thôi không đặt mục tiêu nữa"
     * bị quy về 0 rồi so với mức cũ ⇒ ghi `sua_muc_giam`. Hai chuyện khác hẳn:
     * HẠ mục tiêu là vẫn nhắm, chỉ nhắm thấp hơn; BỎ mục tiêu là thôi nhắm.
     * Gộp lại thì `hv_sua_muc_tieu` đọc ra một người hay hạ chuẩn, trong khi họ
     * chỉ đang dọn hũ — và đó là dữ liệu hành vi của mùa này, không sửa lại được.
     */
    let h = co({ muc: 1_000_000 });
    h = sua(h, { muc: null }, LUC);
    expect(h.muc).toBeNull();
    expect(h.lichSu.map((d) => d.ma)).toEqual(['tao']);
  });

  it('⭐ ĐẶT MỨC lần đầu (null → có) ghi là TĂNG, không im lặng (R10)', () => {
    let h = co({});
    expect(h.muc).toBeNull();
    h = sua(h, { muc: 500_000 }, LUC);
    expect(h.lichSu.map((d) => d.ma)).toEqual(['tao', 'sua_muc_tang']);
  });

  it('⭐ nhãn CHƯA ĐẶT thì không phát gì — tuyệt đối không thay bằng "khac"', () => {
    /*
     * "Chưa phân loại" và "phân loại là khác" là HAI chuyện khác nhau. Đoán hộ một
     * giá trị để cho đủ ô là làm bẩn đúng cái cohort mà nhãn sinh ra để phục vụ
     * (D62/P7 — thiếu mẫu là null, không phải một giá trị bịa).
     */
    const ra = nhanNguNghia(tuTao({ ten: 'Gì đó nhỏ nhỏ' }, LUC, 'h3'));
    expect(ra).not.toHaveProperty('y_loai');
    expect(ra).not.toHaveProperty('y_han');
    expect(ra).not.toHaveProperty('y_uu_tien');
    expect(JSON.stringify(ra)).not.toContain('khac');
    expect(ra.trang_thai).toBe('dang_chay');   // thứ luôn biết thì vẫn phát
  });

  it('nhãn khớp miền của sổ đăng ký đặc trưng (một nguồn — D61)', () => {
    // Nếu ai đó thêm một loại hũ ở client mà quên sổ đăng ký server, dữ liệu sẽ bị
    // từ chối ở cửa và không ai biết vì sao — nên khoá hai danh sách vào nhau.
    expect([...LOAI_HU]).toEqual(['an_uong', 'di_lai', 'giao_duc', 'thiet_bi',
      'du_lich', 'du_phong', 'tra_no', 'qua_tang', 'su_kien', 'suc_khoe', 'choi', 'khac']);
    expect([...HAN_HU]).toEqual(['ngan', 'vua', 'dai']);
    expect([...UU_TIEN_HU]).toEqual(['cao', 'vua', 'thap']);
  });
});

describe('§II — MÁY TRẠNG THÁI: tạm dừng ≠ bỏ dở (C8)', () => {
  it('đường sống: chạy → tạm dừng → tiếp tục → xong', () => {
    let h = co();
    h = doiTrangThai(h, 'tam_dung', LUC);
    expect(h.trangThai).toBe('tam_dung');
    h = doiTrangThai(h, 'dang_chay', LUC);
    h = doiTrangThai(h, 'xong', LUC);
    expect(h.lichSu.map((d) => d.ma))
      .toEqual(['tao', 'tam_dung', 'tiep_tuc', 'xong']);
  });

  it('⭐ BỎ RỒI MỞ LẠI ĐƯỢC, và dấu là "mo_lai" chứ không phải "tiep_tuc"', () => {
    // Người quay lại với một mục tiêu đã bỏ là tín hiệu phục hồi đắt nhất — trộn nó
    // vào "tiếp tục sau khi tạm dừng" là mất luôn phân biệt đó.
    let h = doiTrangThai(co(), 'bo_do', LUC);
    h = doiTrangThai(h, 'dang_chay', LUC);
    expect(h.trangThai).toBe('dang_chay');
    expect(h.lichSu.at(-1)!.ma).toBe('mo_lai');
  });

  it('XONG là cuối — không mở lại (nếu không thì tỷ lệ hoàn thành đếm trùng)', () => {
    const h = doiTrangThai(co(), 'xong', LUC);
    expect(chuyenDuoc('xong', 'dang_chay')).toBe(false);
    expect(() => doiTrangThai(h, 'dang_chay', LUC)).toThrow(LoiHu);
  });

  it('từ TẠM DỪNG bỏ thẳng được, không bắt quay lại chạy trước', () => {
    expect(chuyenDuoc('tam_dung', 'bo_do')).toBe(true);
    const h = doiTrangThai(doiTrangThai(co(), 'tam_dung', LUC), 'bo_do', LUC);
    expect(h.trangThai).toBe('bo_do');
  });

  it('lịch sử chỉ GHI THÊM, không ghi đè (P17)', () => {
    let h = co();
    const truoc = h.lichSu.length;
    h = doiTrangThai(h, 'tam_dung', LUC);
    h = sua(h, { ten: 'Tên khác' }, LUC);
    expect(h.lichSu.length).toBe(truoc + 2);
    expect(h.lichSu[0]!.ma).toBe('tao');   // dấu đầu không bao giờ mất
  });
});

describe('§III — TỰ TẠO + MẪU: hai đường vào', () => {
  it('⭐ TẠO HŨ CHỈ VỚI MỘT CÁI TÊN — không menu nào bắt buộc', () => {
    /*
     * Founder 31/08 bác thẳng bản đầu: *"user tự điền tên nghĩa là họ muốn tự tạo 1
     * hũ mục tiêu nhỏ gì đó"*. Bản đầu bắt đủ tên + loại + hạn + ưu tiên + icon mới
     * cho tạo — tức đường TỰ TẠO khó hơn đường chọn mẫu, và user phải điền form ĐỂ
     * PHỤC VỤ DATASET (trái P16/P19). Bài này khoá chiều ngược lại.
     */
    const h = tuTao({ ten: 'Mua tai nghe' }, LUC, 'h1');
    expect(h.ten).toBe('Mua tai nghe');
    expect(h.trangThai).toBe('dang_chay');
    expect(h.loai).toBeNull();
    expect(h.han).toBeNull();
    expect(h.uuTien).toBeNull();
    expect(h.muc).toBeNull();
    expect(h.icon, 'có icon mặc định để không phải chọn').toBe(ICON_MAC_DINH);
  });

  it('phân loại là TUỲ CHỌN, nhưng đưa vào thì phải hợp lệ', () => {
    const h = co({ loai: 'thiet_bi', han: 'ngan', uuTien: 'cao', icon: 'shop' });
    expect(h.loai).toBe('thiet_bi');
    expect(() => co({ loai: 'bia_dat' as never })).toThrow(LoiHu);
    expect(() => co({ icon: 'khong_co' as never })).toThrow(LoiHu);
  });

  it('⭐ phân loại THÊM SAU được, và GỠ về trống cũng được', () => {
    // Mời phân loại sau bằng một chạm là hợp lệ; CHẶN tạo hũ thì không.
    let h = tuTao({ ten: 'Quà sinh nhật mẹ' }, LUC, 'h2');
    h = sua(h, { loai: 'qua_tang', uuTien: 'cao' }, LUC);
    expect(nhanNguNghia(h).y_loai).toBe('qua_tang');
    h = sua(h, { loai: null, uuTien: null }, LUC);
    expect(nhanNguNghia(h)).not.toHaveProperty('y_loai');
  });

  it('tên rỗng là LỖI, không phải tên mặc định im lặng', () => {
    expect(() => co({ ten: '   ' })).toThrow(/cần một cái tên/);
  });

  it('⭐ mức để TRỐNG được — app không tự sáng tác con số (P3 🔒)', () => {
    expect(co().muc).toBeNull();
    expect(() => co({ muc: -5 })).toThrow(LoiHu);
    expect(() => co({ muc: 0 })).toThrow(LoiHu);
  });

  it('tạo từ mẫu giữ nhãn của mẫu, nhưng SỬA ĐƯỢC hết (mẫu không phải cái lồng)', () => {
    const m = MAU_HU.find((x) => x.id === 'du_lich')!;
    let h = tuMau(m, LUC, 'h9');
    expect(h.tuMauId).toBe('du_lich');
    expect(h.loai).toBe(m.loai);
    h = sua(h, { loai: 'qua_tang', uuTien: 'cao', icon: 'medal' }, LUC);
    expect(h.loai).toBe('qua_tang');
    expect(nhanNguNghia(h).tu_mau).toBe(true);  // vẫn nhớ nó khởi đi từ mẫu
  });

  it('mọi mẫu dùng icon CÓ THẬT và có một dòng vì-sao (P14)', () => {
    for (const m of MAU_HU) {
      expect(ICON_HU as readonly string[], `${m.id}: icon lạ`).toContain(m.icon);
      expect(LOAI_HU as readonly string[], `${m.id}: loại lạ`).toContain(m.loai);
      expect(m.viSao.length, `${m.id}: thiếu vì-sao-hợp`).toBeGreaterThan(15);
    }
  });

  it('⚠ vì-sao-hợp chỉ MÔ TẢ, không kê đơn (A10 🔒)', () => {
    /*
     * ⚠ DÙNG LẠI `TU_KE_DON` DÙNG CHUNG, không tự chế regex (D61 — bản thứ hai sẽ
     * trôi). Bộ này cố ý THÔ: nó bắt cả "nên" nghĩa LIÊN TỪ. Đó là lựa chọn đúng —
     * một guard thô mà chặt đáng tin hơn một guard thông minh mà có lỗ, và cái giá
     * chỉ là ta viết content tránh một chữ. Chính bài này vừa bắt tôi một lần: "có
     * mốc thời gian, NÊN tiến độ dễ nhìn" — vô hại, nhưng sửa chữ rẻ hơn nới guard.
     */
    for (const m of MAU_HU) {
      for (const tu of TU_KE_DON) {
        expect(m.viSao.toLowerCase().includes(tu),
          `mẫu ${m.id} có từ kê đơn "${tu.trim()}": "${m.viSao}"`).toBe(false);
      }
    }
  });

  it('gợi ý mẫu: 2–4 cái, khác nhau, và đổi theo hoàn cảnh user TỰ KHAI', () => {
    const a = mauHopVoiHoSo({});
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(new Set(a.map((m) => m.id)).size).toBe(a.length);

    const b = mauHopVoiHoSo({ coNo: true });
    expect(b[0]!.id, 'khai có nợ ⇒ hũ trả nợ lên đầu').toBe('tra_no');

    const c = mauHopVoiHoSo({ tuLap: 'phu_thuoc' });
    expect(c[0]!.id).not.toBe('du_phong');   // người phụ thuộc: mục tiêu gần hơn trước
  });
});

describe('§IV — ĐỌC ĐỂ NHÌN (founder: không phải bảng excel)', () => {
  it('⭐ chưa đặt mức ⇒ tiến độ null, KHÔNG phải 0 (P7)', () => {
    expect(tienDo(co(), 0)).toBeNull();
    expect(tienDo(co({ muc: 1000 }), 0), 'đặt mức rồi mà chưa góp ⇒ 0 THẬT').toBe(0);
  });

  it('tiến độ kẹp trong [0,1] — góp vượt mức không cho ra 130%', () => {
    expect(tienDo(co({ muc: 1000 }), 1300)).toBe(1);
    expect(tienDo(co({ muc: 1000 }), -500), 'rút nhiều hơn góp vẫn không vẽ âm').toBe(0);
  });

  it('xếp: đang chạy trước, ưu tiên cao trước, sắp về đích trước', () => {
    const a = co({ ten: 'A', uuTien: 'thap', muc: 100 }, 'a');
    const b = co({ ten: 'B', uuTien: 'cao' }, 'b');
    const c = doiTrangThai(co({ ten: 'C', uuTien: 'cao' }, 'c'), 'tam_dung', LUC);
    const d = doiTrangThai(co({ ten: 'D', uuTien: 'cao' }, 'd'), 'bo_do', LUC);
    expect(sapXep([d, a, c, b]).map((h) => h.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('⭐ hũ CHƯA phân loại xếp như "vừa", không bị đẩy xuống đáy', () => {
    // Đẩy xuống đáy là ngầm phạt người chưa điền form — mà ta vừa bỏ form đi.
    const khongNhan = tuTao({ ten: 'Không nhãn' }, LUC, 'k');
    const thap = co({ ten: 'Ưu tiên thấp', uuTien: 'thap' }, 't');
    const cao = co({ ten: 'Ưu tiên cao', uuTien: 'cao' }, 'c');
    expect(sapXep([thap, khongNhan, cao]).map((h) => h.id)).toEqual(['c', 'k', 't']);
  });

  it('hũ CHƯA đặt mức không bị đẩy xuống đáy (đẩy xuống là ngầm giục điền số)', () => {
    const chuaDat = co({ ten: 'Chưa đặt', uuTien: 'cao' }, 'x');
    const daDat = co({ ten: 'Đã đặt', uuTien: 'thap', muc: 100 }, 'y');
    expect(sapXep([daDat, chuaDat])[0]!.id, 'ưu tiên vẫn thắng tiến độ').toBe('x');
  });
});

describe('§V — ⭐⭐ QUYẾT TOÁN (C7): nấc là câu trả lời của NGƯỜI, không phải phép chia', () => {
  it('⭐⭐⭐ hũ mới tạo có `ketQua` null — app không đoán trước một outcome', () => {
    /*
     * ⚠ `null` ở đây không phải "chưa kịp điền". Nó là phát biểu **chưa tới lúc hỏi**,
     * và nó phải sống được suốt đời hũ nếu user không bao giờ chốt. Một giá trị mặc
     * định (kể cả `'xa'`, kể cả `'dang_tien'`) là app tự trả lời hộ.
     */
    expect(co().ketQua).toBeNull();
    expect(tuMau(MAU_HU[0]!, LUC, 'm1').ketQua).toBeNull();
  });

  it('⭐⭐⭐ MIỀN NẤC SUY TỪ SỔ ĐĂNG KÝ, không chép tay', () => {
    /*
     * ⚠⚠ Đây là sợi dây duy nhất giữa hai đầu. `kq_dat_muc_tieu` là OUTCOME — nó đi
     * thẳng vào dataset, nên một bản sao lệch miền không nổ ở đây mà nổ **ở server, kỳ
     * sau**, khi không còn dựng lại được cú nào đã hỏng. Suy trực tiếp thì lệch là lỗi
     * biên dịch.
     */
    expect(KET_QUA_HU).toBe(SO_DANG_KY.kq_dat_muc_tieu.mien);
    expect([...KET_QUA_HU]).toEqual(['du', 'gan_du', 'dang_tien', 'xa']);
  });

  it('⭐⭐ chốt xong: đổi trạng thái VÀ ghi nấc trong một cú, lịch sử vẫn có dấu', () => {
    const h = quyetToan(co(), 'xong', 'gan_du', '2026-09-06T02:00:00.000Z');
    expect(h.trangThai).toBe('xong');
    expect(h.ketQua).toBe('gan_du');
    expect(h.lichSu.map((d) => d.ma)).toEqual(['tao', 'xong']);
  });

  it('⭐⭐ BỎ giữa chừng cũng quyết toán — và nấc không bị ép về "xa"', () => {
    /*
     * ⚠ Bỏ dở KHÔNG đồng nghĩa gom được ít. Người gom đủ rồi mới đổi ý là một quỹ đạo
     * có thật; ép nấc theo trạng thái là trộn hai trục (`kq_bo_giua_chung` đo trạng
     * thái, `kq_dat_muc_tieu` đo lượng) và làm hỏng cả hai.
     */
    const h = quyetToan(co(), 'bo_do', 'du', LUC);
    expect(h.trangThai).toBe('bo_do');
    expect(h.ketQua).toBe('du');
  });

  it('⭐ nấc lạ bị chặn tại chỗ, và hũ KHÔNG đổi trạng thái', () => {
    const h = co();
    expect(() => quyetToan(h, 'xong', 'gan' as never, LUC)).toThrow(LoiHu);
    expect(h.trangThai, 'ném lỗi thì không được đóng hũ nửa vời').toBe('dang_chay');
  });

  it('⭐ cú chuyển không hợp lệ vẫn bị máy trạng thái chặn (không có cửa sau)', () => {
    // `xong` là điểm cuối; quyết toán không được phép mở một lối vòng qua `chuyenDuoc`.
    const xong = quyetToan(co(), 'xong', 'du', LUC);
    expect(() => quyetToan(xong, 'bo_do', 'xa', LUC)).toThrow(LoiHu);
  });
});

describe('§VI — ⭐⭐ RESET: dời MỐC, không cất tổng, không xoá mức (phương án A, D292)', () => {
  const MOC = '2026-09-07T08:00:00.000Z';

  it('⭐⭐⭐ hũ mới `mocGop === null` (từ đầu) — kể cả tạo từ mẫu', () => {
    expect(co().mocGop).toBeNull();
    expect(tuMau(MAU_HU[0]!, LUC, 'm').mocGop).toBeNull();
  });

  it('⭐⭐⭐ reset ⇒ `mocGop = lúc bấm`, `muc` GIỮ NGUYÊN, trạng thái không đổi, vẫn không `daGop`', () => {
    /*
     * RESET ≠ GIA HẠN: gia hạn xoá mức, reset giữ mức. Và reset không được lén cất một con
     * số 0 nào lên hũ — "về 0" là hệ quả của phép cộng từ mốc, không phải một trường.
     */
    const h = resetGop(co({ muc: 2_000_000 }), MOC);
    expect(h.mocGop).toBe(MOC);
    expect(h.muc, 'RESET không phải GIA HẠN — mức ở lại').toBe(2_000_000);
    expect(h.trangThai).toBe('dang_chay');
    expect(h.ketQua).toBeNull();
    expect(h).not.toHaveProperty('daGop');
  });

  it('⭐ KHÔNG ghi dấu lịch sử — `CHUYEN_TIEP_HU` chưa có mã, và agent không tự thêm (A8.2)', () => {
    // Tới lúc founder cấp mã (kèm migration nới CHECK), bài này ĐỔI cùng một commit.
    const h = resetGop(co(), MOC);
    expect(h.lichSu.map((d) => d.ma)).toEqual(['tao']);
    expect(CHUYEN_TIEP as readonly string[]).not.toContain('reset');
  });

  it('⭐⭐ `sua` / `doiTrangThai` / `quyetToan` GIỮ mốc — không cú nào làm rơi nó', () => {
    const h = resetGop(co({ muc: 1000 }), MOC);
    expect(sua(h, { ten: 'Khác', muc: 5000 }, LUC).mocGop).toBe(MOC);
    expect(doiTrangThai(h, 'tam_dung', LUC).mocGop).toBe(MOC);
    expect(quyetToan(h, 'xong', 'du', LUC).mocGop).toBe(MOC);
  });

  it('reset lần hai dời mốc tới lần hai — không giữ mốc cũ', () => {
    const h = resetGop(resetGop(co(), MOC), '2026-09-08T08:00:00.000Z');
    expect(h.mocGop).toBe('2026-09-08T08:00:00.000Z');
  });

  it('tạm dừng vẫn reset được; hũ `xong` thì KHÔNG — điểm cuối là điểm cuối', () => {
    expect(resetGop(doiTrangThai(co(), 'tam_dung', LUC), MOC).mocGop).toBe(MOC);
    const xong = quyetToan(co(), 'xong', 'du', LUC);
    expect(() => resetGop(xong, MOC)).toThrow(LoiHu);
  });
});
