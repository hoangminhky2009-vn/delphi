/**
 * PFM — KÍCH ĐỒNG BỘ: cái nút bấm cuối cùng nối hai driver (`dong_bo_chay` · `ket_chay`)
 * vào vòng đời của app. Trước tệp này, cả hai driver đã khép vòng về mã nhưng **chưa có
 * ai gọi** (D260 · D264 §"Chưa nghiệm thu được") — một hàng đợi gom mãi mà không gửi.
 *
 * ⚠⚠ VÌ SAO HOOK MẠNG NẰM Ở `KhoProvider`, không ở từng màn: mọi màn PFM (SỔ · HŨ · GƯƠNG
 * · CÀI ĐẶT) đều bọc `KhoProvider`, nên đó là MỘT chỗ mà cả bốn màn cùng đi qua. Đặt ở
 * từng màn là bốn bản sao của cùng một quyết định "khi nào gửi" — và bản ở màn ít mở
 * nhất sẽ trôi (A11.5/D61). Đặt ở `main.tsx` thì không có kho để đưa cho driver.
 *
 * ⚠⚠ VÌ SAO CỔNG BẰNG BỐN CỬA CONSENT (`/me.pfm.cua`), không bằng cờ nào khác: server
 * canh đúng những cột ấy (`POST /dong-bo` ⇒ `dac_trung`, `POST /luu` ⇒ `ket` —
 * `CUA_CANH_DUONG`). Gửi khi cửa đóng là một cú 403 chắc chắn, tốn một request trong
 * ngân sách 1M/tháng cho một câu trả lời đã biết trước. Và khách/chưa tải (`null`) thì
 * không làm gì — nên mọi bài test màn hiện có (fetch mặc định 401) không tự bắn mạng.
 *
 * ⚠⚠ KHÔNG BAO GIỜ ĐỂ MỘT PROMISE BỊ TỪ CHỐI LỌT RA `visibilitychange`. Hai driver đã tự
 * nuốt, nhưng lời hứa ấy chỉ đúng cho thân của chúng — `docChia` đứng TRƯỚC driver két,
 * và một ngày nào đó có người thêm một bước trước driver. Hook bọc thêm một lớp `.catch`
 * và ĐẾM (`pfm_lo_loi`) thay vì nuốt im lặng.
 *
 * ⚠ "MỘT LẦN MỖI PHIÊN" là cờ MODULE, không phải state React: mỗi màn PFM mount một
 * `KhoProvider` riêng, và chuyển màn SỔ → HŨ → GƯƠNG mà mỗi lần lại gửi một lô là đốt
 * suất ngày (`SO_LAN_LUU_NGAY = 2`, D264) cho những cú chuyển tab.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { CuaPfm } from '@config/pfm_consent';
import { useMe } from '../api/queries.js';
import { cuaTuMe } from '../api/pfm.js';
import { ghiDo } from '../lib/telemetry.js';
import type { KhoPfm } from './kho.js';
import { dongBoMotLuot, type KetQuaLuot } from './dong_bo_chay.js';
import { xepGoiKy } from './goi_ky.js';
import { saoLuuMotLuot, type KetQuaSaoLuu } from './ket_chay.js';
import { docChia } from './ket_may.js';
import { bayGio, homNay, thangNay } from './thoi_gian.js';

export interface MocKich {
  ngay: string;
  luc: string;
  /** `'YYYY-MM'` — tháng máy đang sống; xem cảnh báo `thangSong` ở `ket_chay.ts`. */
  thangSong: string;
}

export interface KetQuaKich {
  /** Vắng khi cửa `dac_trung` đóng. */
  dongBo?: KetQuaLuot;
  /** Vắng khi cửa `ket` đóng HOẶC máy chưa có chìa (chưa làm lễ mã ở Cài đặt). */
  saoLuu?: KetQuaSaoLuu;
}

/**
 * MỘT CÚ KÍCH: đồng bộ lô nếu cửa `dac_trung` mở; sao lưu két nếu cửa `ket` mở VÀ máy
 * đã có chìa. Trả cả hai kết quả để màn nào muốn nói ra `vuong` thì nói.
 *
 * ⚠ Kiểm chìa Ở ĐÂY dù `saoLuuMotLuot` cũng kiểm: driver trả `vuong: 'chua_co_chia'`,
 * và một màn hiển thị `vuong` sẽ nhắc "chưa có chìa" với người chưa hề mở khối két —
 * đó là nhắc một việc họ không chọn làm. Vắng mặt (`undefined`) mới đúng nghĩa.
 * ⚠ `instanceof CryptoKey`, không `!== null` — cùng lý do `ket_chay.ts` §`chayLuot`.
 */
export async function kichDongBo(
  kho: KhoPfm, cua: Record<CuaPfm, boolean>, moc: MocKich,
): Promise<KetQuaKich> {
  const ra: KetQuaKich = {};
  if (cua.dac_trung) {
    /*
     * D325 — XẾP GÓI KỲ TRƯỚC KHI GỬI. Trước D325 không ai dựng gói (`goi_ky.ts` §vì sao),
     * nên lượt gửi chỉ chở "nhịp". ⚠ Hỏng khi dựng gói KHÔNG được chặn lượt gửi nhịp đang
     * chờ: đếm (`pfm_lo_loi` · `goi_ky`) rồi gửi tiếp những gì đã có trong hàng đợi.
     */
    try {
      await xepGoiKy(kho, moc.thangSong, moc.luc);
    } catch {
      ghiDo('pfm_lo_loi', { chi_tiet: { loai: 'goi_ky' } });
    }
    ra.dongBo = await dongBoMotLuot(kho, moc.ngay, moc.luc);
  }
  if (cua.ket && (await docChia(kho)) instanceof CryptoKey) {
    ra.saoLuu = await saoLuuMotLuot(kho, moc.ngay, moc.luc, moc.thangSong);
  }
  return ra;
}

/* ═══ trạng thái phiên — cấp module, xem khối đầu tệp ═══════════════════════ */

let daKichLucMo = false;
/** Cú đang chạy — hai sự kiện sát nhau (StrictMode · hidden ngay sau mount) dùng chung. */
let dangKich: Promise<void> | null = null;

/** Chỉ cho test: quên "đã kích lúc mở" để bài sau bắt đầu sạch. */
export function quenKichChoTest(): void {
  daKichLucMo = false;
  dangKich = null;
}

function kichAnToan(kho: KhoPfm, cua: Record<CuaPfm, boolean>): Promise<void> {
  if (dangKich) return dangKich;
  dangKich = kichDongBo(kho, cua, { ngay: homNay(), luc: bayGio(), thangSong: thangNay() })
    .then(
      () => undefined,
      () => {
        /*
         * Lớp lưới thứ hai. `pfm_lo_loi` là mã có sẵn trong `config/telemetry.ts`
         * (D259) — `loai: 'kich'` để phân biệt với món bị server từ chối (`nhip`/`goi`)
         * mà driver đồng bộ đếm bằng cùng mã. `ghiDo` không bao giờ ném.
         */
        ghiDo('pfm_lo_loi', { chi_tiet: { loai: 'kich' } });
      },
    )
    .finally(() => { dangKich = null; });
  return dangKich;
}

/**
 * Gọi trong `KhoProvider`. Chạy MỘT lần mỗi phiên khi lần đầu có cả kho lẫn cửa (và có
 * ít nhất một cửa gửi được), cộng mỗi lần app rời mắt (`visibilitychange → hidden`).
 *
 * ⚠ `cua` là memo theo `/me`, không tính lại mỗi render: effect mount phụ thuộc vào nó,
 * và một object mới mỗi render sẽ chạy lại effect mỗi render (cờ module chặn được, nhưng
 * đó là chặn hậu quả chứ không phải sửa nguyên nhân).
 * ⚠ Listener `hidden` đọc `kho`/`cua` qua ref: đăng ký MỘT lần lúc mount, nhưng phải thấy
 * bản mới nhất — người dùng bật cửa ở Cài đặt rồi rời app phải được gửi ngay lượt ấy.
 */
export function useKichDongBo(kho: KhoPfm | null): void {
  const { data: me } = useMe();
  const cua = useMemo(() => cuaTuMe(me), [me]);
  const moiNhat = useRef({ kho, cua });
  moiNhat.current = { kho, cua };

  useEffect(() => {
    if (kho === null || cua === null) return;
    if (!cua.dac_trung && !cua.ket) return;   // không cửa nào gửi được ⇒ chưa tiêu "một lần"
    if (daKichLucMo) return;
    daKichLucMo = true;
    void kichAnToan(kho, cua);
  }, [kho, cua]);

  useEffect(() => {
    const nghe = (): void => {
      if (document.visibilityState !== 'hidden') return;
      const { kho: k, cua: c } = moiNhat.current;
      if (k === null || c === null) return;
      void kichAnToan(k, c);
    };
    document.addEventListener('visibilitychange', nghe);
    return () => document.removeEventListener('visibilitychange', nghe);
  }, []);
}
