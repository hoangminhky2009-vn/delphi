/**
 * M3 · LĂNG KÍNH DANH MỤC + M4 · LỊCH TRÌNH VÒNG (D90, thi công 17/08).
 *
 * Founder D90: người mới không thiếu GIÂY, họ thiếu chỗ đặt sự chú ý. Hai khối
 * này giảm số thứ phải TỰ CỘNG NHẨM mỗi vòng, KHÔNG giảm số thứ có trong trò —
 * mọi người chơi cùng một bàn, cùng đủ cơ chế (khác hẳn thang "nhập môn" D90 đã bác).
 *
 * ⚠ LĂNG KÍNH CHỈ MÔ TẢ, KHÔNG KÊ ĐƠN (A10 + D85 §1.2): nó nói *"đội bạn ĐANG
 * LÀ GÌ"* (trait tracker TFT), tuyệt đối không gợi ý phơi nhiễm bao nhiêu, không
 * tô "đúng/sai" cho một tỷ lệ. Ba trục RỦI RO · PHÒNG THỦ · TIỀN MẶT chính là ba
 * thứ D85 §1.2 cấm THƯỞNG — nhưng cấm THƯỞNG không phải cấm CHO THẤY: giấu nó
 * đi thì người chơi vẫn có tỷ lệ ấy, chỉ là phải cộng nhẩm mới biết.
 * ⚠ Về CHÍNH MÌNH ⇒ A3.1 sạch (không lộ gì của người khác).
 * Client thuần: mọi số suy từ payload đang có, không thêm request, không log.
 */
import type { ReactNode } from 'react';
import type { TaiSanDTO } from '@/api/holdem';
import s from './LangKinh.module.css';

export interface PhanBo { rui_ro: number; phong_thu: number; tien_mat: number }

/**
 * Phần trăm NAV theo ba trục. `viThe` = tiền đang nằm ở từng mã (server gửi),
 * `tienMat` = tiền mặt. Làm tròn để TỔNG luôn đúng 100 (dồn dư vào trục lớn
 * nhất) — ba số cộng lại ra 99 là thứ người ta nhìn thấy ngay và mất tin.
 */
export function phanBoNav(
  viThe: Record<string, number>, tienMat: number, taiSan: readonly TaiSanDTO[],
  /**
   * D342 — KÝ QUỸ KHỐNG là một phần NAV, và là một cược RỦI RO (ăn khi giá rơi, cháy khi giá
   * lên) bất kể mã nền thuộc nhóm nào. Thiếu nó thì mở khống 100% tiền mặt hiện "RỦI RO →
   * 100%" như thể cả ví vừa đổ vào mã dài (trận founder 16/09, vòng 3).
   */
  viKhong: Readonly<Record<string, number>> = {},
): PhanBo {
  let ruiRo = 0; let phongThu = 0;
  for (const [ma, tien] of Object.entries(viThe)) {
    const nhom = taiSan.find((t) => t.id === ma)?.nhom;
    if (nhom === 'phong_thu') phongThu += tien; else ruiRo += tien;
  }
  for (const tien of Object.values(viKhong)) ruiRo += Math.max(0, tien);
  const tong = ruiRo + phongThu + Math.max(0, tienMat);
  if (tong <= 0) return { rui_ro: 0, phong_thu: 0, tien_mat: 100 };
  const raw = {
    rui_ro: (ruiRo * 100) / tong,
    phong_thu: (phongThu * 100) / tong,
    tien_mat: (Math.max(0, tienMat) * 100) / tong,
  };
  const lam = {
    rui_ro: Math.floor(raw.rui_ro), phong_thu: Math.floor(raw.phong_thu), tien_mat: Math.floor(raw.tien_mat),
  };
  const du = 100 - (lam.rui_ro + lam.phong_thu + lam.tien_mat);
  if (du > 0) {
    const truc = (['rui_ro', 'phong_thu', 'tien_mat'] as const)
      .reduce((a, b) => (raw[a] >= raw[b] ? a : b));
    lam[truc] += du;
  }
  return lam;
}

/** Thanh ba đoạn — HUD (gọn) hoặc trong DANH MỤC SAU LỆNH (có nhãn). */
export function LangKinh({ pb, nhan = false, truoc, nhipVong, phai }: {
  pb: PhanBo;
  nhan?: boolean;
  /** Phân bổ TRƯỚC lệnh — hiện mũi tên "trước → sau" trong xem-trước. */
  truoc?: PhanBo | undefined;
  /**
   * ⭐ 23/08 — NHỊP CỦA VÒNG VỪA CHỐT: `+1` lãi · `-1` lỗ · `0`/vắng thì đứng im.
   *
   * Founder: *"Nav tổng tài sản có thanh ở trên rồi đ** cần thanh ở dưới nữa,
   * làm thanh ở trên sống hơn 1 tý khi tăng/giảm như kiểu là đỏ và rung nhẹ khi
   * bị lỗ hoặc xanh và phát sáng khi lãi"*.
   *
   * ⚠ Đây là chỗ tinh tế: thanh này CHIA NAV theo ba trục, nó KHÔNG đo lãi/lỗ.
   * Nên nhịp phải là một lớp phủ TẠM THỜI lên khung thanh (viền + quầng + rung),
   * TUYỆT ĐỐI không nhuộm ba đoạn bên trong — ba đoạn ấy đang nói "danh mục
   * đang là gì", và tô đỏ chúng khi lỗ là nói dối về phân bổ.
   *
   * ⚠ §1.2 vẫn nguyên: nhịp bám vào KẾT QUẢ vòng (lãi hay lỗ), không bám vào
   * mức phơi nhiễm — một người 100% tiền mặt mà vòng lãi thì thanh vẫn sáng
   * xanh. Nó không khen ai vì đã liều.
   */
  nhipVong?: { dau: -1 | 0 | 1; vong: number } | undefined;
  /**
   * Ô dán MÉP PHẢI hàng nhãn — chỗ founder khoanh đỏ 23/08 để đặt con số lãi/lỗ
   * vòng. Nhận `ReactNode` chứ không tự vẽ: lăng kính là khối MÔ TẢ DANH MỤC,
   * nó không được biết gì về lãi lỗ. Ai cần thì nhét vào.
   */
  phai?: ReactNode;
}) {
  const doan = [
    { k: 'rui_ro' as const, ten: 'RỦI RO', cls: s.ruiRo },
    { k: 'phong_thu' as const, ten: 'PHÒNG THỦ', cls: s.phongThu },
    { k: 'tien_mat' as const, ten: 'TIỀN MẶT', cls: s.tienMat },
  ];
  return (
    <div className={s.khoi} data-tap="lang-kinh" aria-label="Danh mục đang là gì">
      <div
        className={[
          s.thanh,
          nhipVong?.dau === 1 ? s.thanhLai : '',
          nhipVong?.dau === -1 ? s.thanhLo : '',
        ].filter(Boolean).join(' ')}
        /*
         * ⚠ `key` neo vào SỐ VÒNG, không vào dấu lãi/lỗ. React dựng lại phần tử
         * khi key đổi ⇒ animation chạy lại. Neo vào dấu thì HAI VÒNG LỖ LIÊN
         * TIẾP im ru (dấu vẫn `-1`, lớp còn nguyên, CSS không chạy lại) — đúng
         * bẫy `.lat`/`.sang` của `GameCard` đã dính một lần, và nó im lặng:
         * hiệu ứng vẫn "có", chỉ là không diễn ở đúng lúc cần nhất.
         */
        key={`nhip-${nhipVong?.vong ?? 0}`}
      >
        {doan.map((d) => (pb[d.k] > 0 ? (
          <span key={d.k} className={`${s.doan} ${d.cls}`} style={{ width: `${pb[d.k]}%` }} />
        ) : null))}
      </div>
      {nhan && (
        <div className={s.nhanHang}>
          {doan.map((d) => (
            <span key={d.k} className={s.mot}>
              <span className={`${s.cham} ${d.cls}`} aria-hidden />
              {d.ten}{' '}
              <b className={s.so}>
                {truoc && truoc[d.k] !== pb[d.k] ? `${truoc[d.k]}→${pb[d.k]}%` : `${pb[d.k]}%`}
              </b>
            </span>
          ))}
          {/*
            ⚠ `role="status"` đặt Ở ĐÂY, không đặt trên con số bên trong: con số
            mang `key` theo vòng nên nó bị DỰNG LẠI mỗi vòng, mà một vùng live
            vừa-sinh-ra-vừa-có-nội-dung thì trình đọc màn hình xướng không đáng
            tin. `LangKinh` không remount, nên từ vòng thứ hai trở đi đây là một
            vùng ĐÃ CÓ SẴN mà ruột đổi — khuôn được hỗ trợ tin cậy nhất.
            (Trước 23/08 vai này nằm ở headline kết quả vòng; thu gọn khối làm
            rơi mất nó, và người dùng trình đọc màn hình thôi được xướng lãi/lỗ.)
          */}
          {phai && <span className={s.phai} role="status">{phai}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * M4 · LỊCH TRÌNH VÒNG — nhịp đoán trước được. TFT không bất ngờ về CẤU TRÚC,
 * chỉ bất ngờ về NỘI DUNG; ta cũng vậy: nói vòng nào có chợ / có lá / có kỳ ngộ,
 * KHÔNG nói ô nào sẽ lật (luật 7 của thẻ kết trận, và A3.1).
 */
/**
 * Tên loại vòng — MỘT nguồn cho cả dải lịch lẫn nhãn ở hàng ROUND.
 * Hai bảng chữ cho cùng một thứ là hai bảng sẽ trôi (D61), và cú trôi ở đây
 * biểu hiện là "dải nói LÁ còn hàng trên nói CHỢ".
 */
/*
 * ⚠ 15/09 (D336) — `chien_thuat` đọc 'LÕI', không 'LÁ'. Cùng một màn in "CẦM CHIP → CHẠM LÁ"
 * (lá = sáu mã tài sản) và "LÕI CHIẾN THUẬT · CHỌN 1 LÕI" (quầy vòng này): nhãn vòng ghi LÁ là
 * gọi quầy lõi bằng tên của sáu mã. Tự chơi bàn tập 15/09 đọc ra ba tên cho một thứ.
 */
export const LOAI_VONG: Record<string, string> = {
  tai_san: 'CHỢ', chien_thuat: 'LÕI', khong: 'KHOÁ', ky: 'KỲ NGỘ',
};

/** Loại của MỘT vòng (1-based) — dùng cho nhãn ở hàng ROUND. */
export function loaiVong(
  nhip: readonly string[], vong: number, vongKyNgo: readonly number[] = [],
): string {
  if (vongKyNgo.includes(vong)) return LOAI_VONG.ky!;
  return LOAI_VONG[nhip[vong - 1] ?? 'khong'] ?? '';
}

export function LichVong({ nhip, vong, vongKyNgo = [] }: {
  nhip: readonly string[];
  vong: number;
  vongKyNgo?: readonly number[];
}) {
  if (nhip.length === 0) return null;
  const ky = (i: number): string => (vongKyNgo.includes(i + 1) ? 'ky' : (nhip[i] ?? 'khong'));
  return (
    <div
      className={s.lich}
      data-tap="lich-vong"
      /*
       * ⚠ Dải nay KHÔNG CÓ CHỮ (xem lý do trong CSS), nên nhãn này là đường đọc
       * DUY NHẤT còn lại cho trình đọc màn hình — nó phải nói đủ, không phải
       * "Lịch trình các vòng" chung chung như khi mỗi ô còn tự xưng tên.
       */
      aria-label={`Lịch ${nhip.length} vòng: ${nhip
        .map((_, i) => `${i + 1} ${LOAI_VONG[ky(i)] ?? ''}`).join(', ')}`}
    >
      {nhip.map((_, i) => (
        <span
          key={i}
          className={[
            s.o, s[`o_${ky(i)}`] ?? '',
            i + 1 < vong ? s.oQua : '', i + 1 === vong ? s.oNay : '',
          ].filter(Boolean).join(' ')}
          aria-hidden
        />
      ))}
    </div>
  );
}
