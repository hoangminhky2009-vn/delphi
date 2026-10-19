/**
 * BẢN DEMO — SỔ MẪU PFM (founder 28/09: *"giả định luôn phần dữ liệu cho PFM"*).
 *
 * Một sinh viên năm ba ở TP.HCM ghi sổ khoảng mười tuần: tiền vào (bố mẹ gửi đầu tháng · lương làm thêm), chi hằng ngày
 * theo đúng nhãn của app, ba hũ tích luỹ góp dần, hồ sơ phỏng vấn đã trả lời. Mọi bản ghi đi qua CHÍNH hàm nghiệp vụ
 * (`taoKhoan` · `taoKhoanPhanBo` · `tuTao` · `suaHoSo`) — không dựng tay ruột bản ghi, để một ràng buộc mới của sổ tự
 * bắt luôn sổ mẫu. Số ngẫu nhiên theo một hạt cố định: mở lại demo ra cùng một cuốn sổ (ngày dời theo hôm nay).
 * Kho TRONG BỘ NHỚ (`KhoTrongBoNho`): đóng tab là mất — đúng lời hứa "không lưu dữ liệu".
 */
import { KhoTrongBoNho, thangCua, type BanGhi } from '@/pfm/kho';
import { taoKhoan, type DauVaoKhoan, type Khoan, type MaNhanKhoan } from '@/pfm/so';
import { taoKhoanPhanBo } from '@/pfm/phan_bo';
import { tuTao, type Hu } from '@/pfm/hu';
import { suaHoSo } from '@/pfm/ho_so';
import { hoSoTuTraLoi } from '@/pfm/phong_van';
import { congNgay, homNay, sinhId } from '@/pfm/thoi_gian';
import { hanTuSoThang } from '@/pfm/vi_the';
import { banLuat, ghiNhanGiuVo, taoLuatMoi } from '@/pfm/luat';
import { mauTheoDieuKien } from '@/pfm/mau_luat';
import { dauTuan, type LuaChonHuong } from '@/pfm/huong';

const SO_NGAY = 70;

export async function khoSoMau(): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  let hat = 20260928;
  const nn = (): number => { hat = (Math.imul(hat, 1664525) + 1013904223) >>> 0; return hat / 2 ** 32; };
  /** Số tiền tròn nghìn trong [a, b]. */
  const tien = (a: number, b: number): number => Math.round((a + nn() * (b - a)) / 1000) * 1000;
  const nay = homNay();
  const dau = congNgay(nay, -SO_NGAY);
  /** Mốc giờ của một ngày địa phương — trưa giờ VN (05:00 UTC), đủ để thứ tự trong ngày ổn định. */
  const lucCua = (ngay: string, phut = 0): string =>
    new Date(Date.parse(`${ngay}T05:00:00.000Z`) + phut * 60_000).toISOString();

  /* ── Hũ — tạo ngày đầu sổ ─────────────────────────────────────────────────────────────── */
  const hu: Hu[] = [
    tuTao({ ten: 'Quỹ dự phòng', loai: 'du_phong', muc: 5_000_000, uuTien: 'cao' }, lucCua(dau), sinhId()),
    tuTao({ ten: 'Laptop mới', loai: 'thiet_bi', muc: 18_000_000 }, lucCua(dau, 1), sinhId()),
    /* D453 — chuyến đi có KỲ HẠN (năm tháng từ ngày đầu sổ): nhịp góp 400k/tháng thì trễ hạn — tấm HƯỚNG học đúng điều
       ấy ("đủ mức nếu giữ nhịp · trễ N tháng so hạn bạn đặt") và bày hướng "tự chia mỗi ngày" cho nó. */
    tuTao({
      ten: 'Đà Lạt tháng 12', loai: 'du_lich', muc: 3_500_000, lenh: { tu: dau, kyHan: hanTuSoThang(dau, 5) },
    }, lucCua(dau, 2), sinhId()),
  ];
  await kho.ghiLo('hu', hu.map((h) => ({ id: h.id, thang: thangCua(dau), suaLuc: lucCua(dau, 2), d: h })));

  /* ── Sổ ──────────────────────────────────────────────────────────────────────────────── */
  const ban: BanGhi<Khoan>[] = [];
  let phut = 10;
  const ghi = (k: Khoan): void => { ban.push({ id: k.id, thang: thangCua(k.ngay), suaLuc: k.suaLuc, d: k }); };
  const chi = (ngay: string, soTien: number, nhan: MaNhanKhoan, ghiChu: string, them: Partial<DauVaoKhoan> = {}) => {
    phut += 7;
    ghi(taoKhoan({ ngay, soTien, nhan, ghiChu, ...them }, lucCua(ngay, phut % 600), sinhId()));
  };
  const vao = (ngay: string, soTien: number, ghiChu: string) => {
    phut += 7;
    ghi(taoKhoan({ ngay, soTien, chieu: 'thu', ghiChu }, lucCua(ngay, phut % 600), sinhId()));
  };
  const gop = (ngay: string, h: Hu, soTien: number) => {
    phut += 7;
    ghi(taoKhoanPhanBo({ ngay, soTien, huId: h.id, phanBo: 'tay' }, lucCua(ngay, phut % 600), sinhId()));
  };

  for (let i = SO_NGAY; i >= 0; i -= 1) {
    const ngay = congNgay(nay, -i);
    const d = Number(ngay.slice(8, 10));
    const thu = new Date(`${ngay}T12:00:00Z`).getUTCDay(); // 0 = chủ nhật
    if (d === 1) vao(ngay, 3_000_000, 'Bố mẹ gửi');
    if (d === 5) {
      vao(ngay, 5_500_000, 'Lương làm thêm');
      gop(ngay, hu[0]!, 800_000);
      gop(ngay, hu[1]!, 1_000_000);
      gop(ngay, hu[2]!, 400_000);
    }
    // Ăn uống: sáng (đa số ngày) · trưa · tối (có hôm nấu ở nhà).
    if (nn() < 0.8) chi(ngay, tien(20_000, 40_000), 'an_uong', 'Bánh mì · cà phê sáng');
    chi(ngay, tien(35_000, 60_000), 'an_uong', 'Cơm trưa');
    if (nn() < 0.7) chi(ngay, tien(40_000, 90_000), 'an_uong', thu === 6 || thu === 0 ? 'Ăn tối với bạn' : 'Cơm tối');
    // Đi lại: xăng mỗi ~4 ngày, Grab hai lần một tuần.
    if (i % 4 === 0) chi(ngay, tien(50_000, 70_000), 'di_lai', 'Đổ xăng');
    if (thu === 2 || thu === 5) chi(ngay, tien(25_000, 60_000), 'di_lai', 'Grab');
    // Chơi: cà phê ba buổi một tuần, phim hai tuần một lần.
    if (thu === 1 || thu === 3 || thu === 6) chi(ngay, tien(45_000, 75_000), 'choi', 'Cà phê học nhóm');
    if (thu === 6 && i % 14 < 7) chi(ngay, 110_000, 'choi', 'Xem phim');
    // Thỉnh thoảng: sách · khám · quà · linh tinh · một món đồ mua vì sale.
    if (d === 10) chi(ngay, tien(350_000, 500_000), 'giao_duc', 'Giáo trình · khoá học online');
    if (d === 18) chi(ngay, tien(100_000, 150_000), 'suc_khoe', 'Thuốc · khám răng');
    if (d === 22 && nn() < 0.6) chi(ngay, 250_000, 'qua_tang', 'Quà sinh nhật bạn');
    if (thu === 4 && nn() < 0.5) chi(ngay, tien(30_000, 120_000), 'khac', 'Đồ dùng lặt vặt');
    if (i === 33) chi(ngay, 890_000, 'thiet_bi', 'Tai nghe (đang giảm giá)', { viSale: true });
    if (i === 12) chi(ngay, 420_000, 'khac', 'Áo khoác (flash sale)', { viSale: true });
  }
  await kho.ghiLo('khoan', ban);

  /* ── Hồ sơ — phỏng vấn đã trả lời, dựng bằng CHÍNH `hoSoTuTraLoi` (nhãn đáp án lấy nguyên từ `CAU_PV`) ────── */
  const traLoi: Record<string, string[] | null> = {
    nguon_thu: ['làm thêm', 'gia đình cho'],
    deu: ['đều mỗi tháng'],
    co_no: ['không có'],
    muc_tieu: ['quỹ dự phòng', 'thiết bị học', 'chuyến đi'],
    luc_tien_ve: ['cất một phần đi'],
    sau_khi_tieu: ['nhẩm lại giá'],
    dau_thang: ['đại khái'],
    nhip: ['đi chơi cùng bạn', 'cuối tháng'],
  };
  // Qua `suaHoSo` — cửa ghi hồ sơ DUY NHẤT (có xếp hàng, gỡ mốc lời đoán khi chip đổi); bài canh cả lớp ở
  // `pfm_ho_so_sua.test.ts` cấm mọi tệp khác gọi thẳng `ghiHoSo` — nó đã bắt đúng dòng này ở bản đầu.
  await suaHoSo(kho, (cu) => ({ ...cu, ...hoSoTuTraLoi(traLoi), tuLap: 'ban_tu_lap', khung: 'hu' }), lucCua(dau, 3));

  /*
   * ── D453 — HAI TUẦN CỦA TẤM HƯỚNG, một luật, và sổ lời đoán của app ─────────────────────────────────────────────────
   * Tuần T−2: chọn "một hũ tiêu dùng cho phần chưa chia" rồi KHÔNG dựng ⇒ dải CHẤM nói thật "chưa dựng".
   * Tuần T−1: chọn "luật ngày tiêu đậm", viết luật ngay hôm ấy, giữ được hai lần cuối tuần ⇒ LÀM TỚI.
   * ⇒ dòng học "1/2 tuần làm tới hướng bạn chọn" + "2/2 lần giữ luật Ngày tiêu đậm". App đoán về chủ sổ: trúng 2, trật 1.
   * Mọi bản ghi qua hàm nghiệp vụ (`taoLuatMoi` · `banLuat` · `ghiNhanGiuVo` · `suaHoSo`) — nếp của tệp.
   */
  const tuanNay = dauTuan(nay);
  const t1 = congNgay(tuanNay, -7);
  const t2 = congNgay(tuanNay, -14);
  const mau = mauTheoDieuKien('ngay_chi_lon');
  let l = taoLuatMoi({
    loiNhac: mau?.loiNhacGoiY ?? 'Hôm nay tiêu đậm rồi — tối nay nấu ở nhà.',
    dieuKien: 'ngay_chi_lon',
    mauId: mau?.id ?? null,
  }, lucCua(t1, 20), sinhId());
  for (const ngay of [congNgay(t1, 5), congNgay(t1, 6)]) {
    l = banLuat(l, lucCua(ngay, 600));
    l = ghiNhanGiuVo(l, 'giu', lucCua(ngay, 780));
  }
  await kho.ghiLo('luat', [{ id: l.id, thang: thangCua(t1), suaLuc: lucCua(congNgay(t1, 6), 780), d: l }]);
  /* 11/10 (câu B): hai tuần dưới là BẢN GHI MÔ HÌNH CŨ (D453) — giữ nguyên làm chứng "hồ sơ cũ vẫn đọc được" (đếm `huong_giu`, dải TUẦN TRƯỚC). Khoá viết
     thẳng (`<mã>:<nhóm|điều kiện>`) vì hàm sinh khoá của mô hình cũ không còn. */
  const huong: LuaChonHuong[] = [
    {
      tuan: t2, khoa: 'hu_cho_chua_chia:tieu_dung', ma: 'hu_cho_chua_chia',
      kieu: 'theo', luc: lucCua(t2, 60), nhom: 'tieu_dung',
    },
    {
      tuan: t1, khoa: 'luat_ngay_dam:ngay_chi_lon', ma: 'luat_ngay_dam',
      kieu: 'theo', luc: lucCua(t1, 10), dk: 'ngay_chi_lon',
    },
  ];
  /* ⚠ LƯỢT GHI THỨ HAI: `suaHoSo` gỡ `doanTu` khi chip nhịp ĐỔI giữa bản cũ và bản mới — lượt đầu đổi từ "chưa có" sang
     "đi chơi cùng bạn", nên mốc lời đoán đặt chung lượt ấy sẽ bị gỡ ngay. Đặt ở lượt sau, khi chip đã đứng yên. */
  await suaHoSo(kho, (cu) => ({
    ...cu,
    huong,
    doanTu: dau,
    soDoan: {
      [`tuan:${congNgay(tuanNay, -21)}`]: { ma: 'ban_ru', kq: 'trung', doDuoc: null, moc: null },
      [`tuan:${t2}`]: { ma: 'ban_ru', kq: 'trung', doDuoc: null, moc: null },
      [`tuan:${t1}`]: { ma: 'ban_ru', kq: 'trat', doDuoc: null, moc: null },
    },
  }), lucCua(t1, 30));
  return kho;
}
