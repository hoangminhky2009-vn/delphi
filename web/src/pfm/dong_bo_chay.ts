/**
 * PFM — DRIVER ĐỒNG BỘ: thứ THẬT SỰ khép vòng `layLo` → `POST /pfm/dong-bo` → `xacNhanGui`.
 *
 * ⚠⚠ MỌI THỨ KHÁC CỦA PFM ĐỀU THUẦN, VÀ ĐÓ LÀ Ý ĐỒ. `dong_bo.ts` gom hàng đợi nhưng
 * không tự gọi mạng; `kho.ts` không đọc đồng hồ; `api/pfm.ts` chuyên chở chứ không quyết
 * định gì. Nên **mọi quyết định bẩn tập trung ở đây**: khi nào gửi, gửi bao nhiêu, lỗi
 * nào thì bỏ món và lỗi nào thì giữ. Một tệp có tác dụng phụ thì phải là MỘT tệp, và nó
 * phải là tệp có chú thích dài nhất.
 *
 * ⚠⚠ LUẬT XƯƠNG SỐNG — BỎ MÓN KHỎI HÀNG ĐỢI CHỈ KHI SERVER ĐÃ TRẢ LỜI VỀ CHÍNH MÓN ĐÓ.
 * Không phải "đã gửi đi", không phải "request xong". Bỏ lúc gửi là đánh cược rằng mạng
 * không bao giờ đứt giữa chừng — và khi nó đứt, dòng đã biến mất khỏi máy mà chưa từng
 * tới nơi, không có bản sao nào để dựng lại.
 */
import { ApiError } from '../api/client.js';
import { guiLo } from '../api/pfm.js';
import { ghiDo } from '../lib/telemetry.js';
import type { KhoPfm } from './kho.js';
import { layLo, xacNhanGui, conLuotLo, ghiNhanGui } from './dong_bo.js';
import { XAC_NHAN_BO_HET } from '@config/pfm_dong_bo';

export interface KetQuaLuot {
  /** `false` khi chưa gửi gì (hàng đợi rỗng, hết suất ngày, hoặc lỗi cả lô). */
  daGui: boolean;
  ghi: number;
  trung: number;
  bo: number;
  /** Số món CÒN LẠI trong hàng đợi sau lượt này. */
  conLai: number;
  /** Vì sao không gửi / gửi hỏng — để màn hình nói được gì đó, không phải để bắt lỗi. */
  vuong?: 'hang_doi_rong' | 'het_suat_ngay' | 'chua_toi_may_chu' | 'may_chu_tu_choi'
    | 'phan_hoi_lech';
}

const RONG = (conLai: number, vuong: KetQuaLuot['vuong']): KetQuaLuot =>
  ({ daGui: false, ghi: 0, trung: 0, bo: 0, conLai, vuong });

/**
 * MỘT LƯỢT đồng bộ. **KHÔNG BAO GIỜ NÉM** — nó được gọi từ `mount` và từ
 * `visibilitychange`, hai chỗ mà một promise bị từ chối là một `unhandledrejection`
 * không ai bắt, và trên PWA thì đó là một dải lỗi đỏ giữa lúc người dùng đang ghi tiền.
 *
 * `ngay`/`luc` do người gọi đưa vào (`thoi_gian.ts`) — tệp này không đọc đồng hồ, đúng
 * khuôn mọi module PFM khác.
 */
export async function dongBoMotLuot(
  kho: KhoPfm, ngay: string, luc: string,
): Promise<KetQuaLuot> {
  if (!await conLuotLo(kho, ngay)) {
    return RONG(await kho.dem('outbox'), 'het_suat_ngay');
  }

  const lo = await layLo(kho);
  if (lo.ids.length === 0) return RONG(0, 'hang_doi_rong');

  let dap;
  try {
    dap = await guiLo(lo.than);
  } catch (e) {
    /*
     * ⚠⚠ HAI LOẠI HỎNG, MỘT CÁCH XỬ LÝ — GIỮ NGUYÊN HÀNG ĐỢI. Kể cả khi máy chủ đã trả
     * lời là KHÔNG (4xx/5xx cả lô), ta vẫn không bỏ món nào: một lỗi CẢ LÔ không nói
     * được món nào hỏng, nên bỏ theo nó là vứt cả món lành.
     * ⚠ Hai nguyên nhân 400-cả-lô đã bị chặn từ trước khi gửi: `layLo` cắt theo cả trần
     * MÓN lẫn trần DÒNG, đúng hai con số server đếm. Không có chốt ấy thì nhánh này là
     * một hàng đợi tắc vĩnh viễn.
     */
    const chuaToi = e instanceof ApiError && e.chuaToiMayChu;
    return RONG(await kho.dem('outbox'), chuaToi ? 'chua_toi_may_chu' : 'may_chu_tu_choi');
  }

  /*
   * ⚠⚠ SOI PHẢN HỒI TRƯỚC KHI XOÁ BẤT CỨ THỨ GÌ. `ket` phải khớp một-một, đúng thứ tự,
   * với thứ vừa gửi. Lệch ⇒ hai đầu dây đã trôi khỏi nhau (đúng loại lỗi sinh ra R8), và
   * lúc đó thứ DUY NHẤT an toàn là **không xoá gì cả**: xoá theo một phản hồi mình không
   * hiểu là mất dữ liệu vĩnh viễn, còn giữ lại thì tệ nhất là gửi lại một lần nữa.
   */
  if (dap.ket.length !== lo.ids.length
      || dap.ket.some((k, i) => k.id !== lo.ids[i])) {
    return RONG(await kho.dem('outbox'), 'phan_hoi_lech');
  }

  /*
   * ⚠ ĐẾM TRƯỚC KHI XOÁ. Mỗi món `bo` là một dòng bị vứt vĩnh viễn — bỏ mà không để lại
   * con số là cách mất dữ liệu êm ái nhất tồn tại. `ghiDo` không bao giờ ném.
   */
  for (const [i, k] of dap.ket.entries()) {
    if (k.ket !== 'bo') continue;
    const m = lo.than[i]!;
    ghiDo('pfm_lo_loi', {
      chi_tiet: m.loai === 'nhip' ? { loai: m.loai, ma: m.ma } : { loai: m.loai },
    });
  }

  /*
   * ⚠ Lọc qua CHÍNH hằng giao ước, dù hôm nay nó gồm cả ba trạng thái nên phép lọc là
   * vô hại. Viết `map` thẳng thì nhanh hơn một dòng, nhưng ngày ai đó thu hẹp giao ước
   * (vd. `bo` không còn được bỏ tự động) thì code này phải ĐI THEO, không phải được
   * phát hiện. Một hằng số chỉ là giao ước nếu có người đọc nó.
   */
  const boDi = dap.ket
    .filter((k) => (XAC_NHAN_BO_HET as readonly string[]).includes(k.ket))
    .map((k) => k.id);
  const conLai = await xacNhanGui(kho, boDi);
  await ghiNhanGui(kho, ngay, 'lo', luc);

  return { daGui: true, ghi: dap.ghi, trung: dap.trung, bo: dap.bo, conLai };
}
