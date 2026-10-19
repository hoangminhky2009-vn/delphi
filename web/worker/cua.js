/**
 * CỬA — Durable Object giữ sổ hàng chờ. Luật nằm ở `cong.js`; đây chỉ là kho.
 *
 * ─── VÌ SAO PHẢI LÀ DURABLE OBJECT ─────────────────────────────────────────
 * Hàng chờ có SỐ THỨ TỰ cần một điểm nối tiếp duy nhất trên toàn cầu. Ba lựa
 * chọn còn lại của Cloudflare free đều KHÔNG làm được, và mỗi cái hỏng một
 * kiểu riêng:
 *   · biến trong isolate — Cloudflare chạy nhiều isolate song song ở nhiều
 *     biên, mỗi cái đếm một sổ ⇒ trần thật = trần × số isolate. Đúng cái
 *     nghiêng làm cổng vô dụng, mà không lộ ra khi thử một mình.
 *   · Workers KV — free chỉ **1.000 lượt GHI mỗi ngày**. Hàng chờ ghi mỗi
 *     lượt hỏi ⇒ cạn trong vài phút.
 *   · Cache API — theo TỪNG trung tâm dữ liệu, không phải toàn cầu.
 *
 * ⚠ NẾU `wrangler deploy` BÁO DURABLE OBJECTS KHÔNG DÙNG ĐƯỢC TRÊN GÓI NÀY:
 * chú thích hai khối `durable_objects` + `migrations` trong `wrangler.jsonc`
 * rồi deploy lại. Worker vẫn chạy y như trước — `index.js` thấy thiếu
 * `env.CUA` thì TẮT CỔNG (mở toang, xem lý do fail-open ở đó). Mất hàng chờ,
 * không mất trang web. Đây là đường lui 30 giây, ghi ra để không ai phải đoán
 * giữa lúc deploy hỏng.
 *
 * ─── SỔ NẰM TRONG BỘ NHỚ, CÓ CHỦ Ý ─────────────────────────────────────────
 * Không ghi xuống storage. DO khởi động lại (deploy mới, Cloudflare dời máy)
 * thì hàng chờ trống và mọi người vào thẳng — CHẤP NHẬN ĐƯỢC: hàng chờ là van
 * xả tải, không phải sổ tiền. Mất nó thì tệ nhất là một nhịp đông người đi
 * qua; ghi xuống storage thì mỗi lượt hỏi thành một lượt ghi, và ta vừa mua
 * lại đúng vấn đề của KV.
 */
import { CONG, quyetDinh, soTrong } from './cong.js';
import { baoKetQua, soSuatTrong, thongKe, xinSuat } from './suat.js';
import { khoaThang } from './dem.js';

/*
 * ─── SỔ SUẤT TRẬN (SPEC tran-tran-ngay) — CÙNG LỚP, KHÁC INSTANCE ─────────
 * `index.js` gọi instance tên `suat-v1` cho đường `/suat/*`, tách khỏi
 * `cong-v1`: một DO xử lý request NỐI TIẾP, nên chung instance là hàng chờ
 * suất trận tranh nhịp với cổng vào app. Cùng LỚP để khỏi thêm khối
 * `migrations` mới vào `wrangler.jsonc` (đường lui 30 giây ở trên vẫn đúng).
 *
 * ⚠ KHÁC sổ cổng: đếm `daDung` (trận đã tạo hôm nay) ĐƯỢC ghi xuống storage.
 * Mất hàng chờ khi DO khởi động lại là chấp nhận được (van xả tải); mất bộ đếm
 * quỹ thì sau mỗi lần deploy cả quỹ ngày được cấp LẠI từ đầu — đúng thứ việc
 * này sinh ra để chặn. Một lượt ghi mỗi trận tạo thật (~vài chục/ngày), không
 * phải mỗi lượt hỏi ⇒ không mua lại vấn đề của KV. Lưới server vẫn chặn trên.
 */
const KHOA_DEM = 'suat_dem';

export class CuaHang {
  constructor(state, env) {
    this.st = soTrong();
    this.suat = soSuatTrong();
    this.state = state;
    this.env = env;
    // Nạp bộ đếm TRƯỚC request đầu tiên. Storage hỏng ⇒ đếm từ 0 (fail-open,
    // lưới server lo phần trên) — không để lỗi nạp làm chết cả cổng.
    state?.blockConcurrencyWhile?.(async () => {
      try {
        const dem = await state.storage?.get(KHOA_DEM);
        if (dem && typeof dem.ngay === 'number' && typeof dem.daDung === 'number') {
          this.suat.ngay = dem.ngay;
          this.suat.daDung = dem.daDung;
        }
      } catch (e) {
        console.error('suat: khong nap duoc bo dem:', e && e.message);
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/suat/')) return this.suatTran(url);
    /*
     * SỔ ĐẾM LƯỢT GỌI VERCEL (D594) — chạy ở instance RIÊNG (`idFromName('dem-v1')`), không chung instance với hàng
     * chờ: hai việc khác nhau không được tranh nhau một hàng đợi nối tiếp. Khác sổ hàng chờ, sổ này GHI storage —
     * nhưng chỉ một lần mỗi lô `LO_XA` lượt (dem.js), không phải mỗi request, nên không mua lại vấn đề của KV.
     */
    if (url.pathname === '/dem') {
      const khoa = `thang:${khoaThang()}`;
      const co = Number((await this.state.storage.get(khoa)) ?? 0);
      if (request.method === 'POST') {
        const n = Number(url.searchParams.get('n') ?? 0);
        if (!Number.isInteger(n) || n <= 0 || n > 100_000) return Response.json({ error: 'n_sai' }, { status: 400 });
        await this.state.storage.put(khoa, co + n);
        return Response.json({ thang: khoaThang(), so: co + n });
      }
      return Response.json({ thang: khoaThang(), so: co });
    }
    const ve = url.searchParams.get('ve') ?? '';
    if (!ve) return Response.json({ error: 'thieu_ve' }, { status: 400 });

    const now = Date.now();
    const kq = quyetDinh(this.st, ve, now, CONG);

    return Response.json({
      ...kq,
      // Số người đang ở trong — cho màn hàng chờ nói thật ("150/150 đang chơi")
      // thay vì chỉ đưa một con số thứ tự trơ trọi.
      dang_trong: this.st.trong.size,
      tran: CONG.TRAN_TRONG,
    });
  }

  /** `/suat/xin?ve=` · `/suat/bao?ve=&ok=1|0` · `/suat/thong-ke`. Luật ở `suat.js`. */
  async suatTran(url) {
    const now = Date.now();
    const ve = url.searchParams.get('ve') ?? '';
    if (url.pathname === '/suat/thong-ke') return Response.json(thongKe(this.suat, now));
    if (!ve) return Response.json({ error: 'thieu_ve' }, { status: 400 });
    if (url.pathname === '/suat/xin') return Response.json(xinSuat(this.suat, ve, now));
    if (url.pathname === '/suat/bao') {
      const ok = url.searchParams.get('ok') === '1';
      baoKetQua(this.suat, ve, ok, now);
      if (ok) {
        try {
          await this.state?.storage?.put(KHOA_DEM, { ngay: this.suat.ngay, daDung: this.suat.daDung });
        } catch (e) {
          console.error('suat: khong ghi duoc bo dem:', e && e.message);
        }
      }
      return Response.json({ ok: true });
    }
    return Response.json({ error: 'khong_co' }, { status: 404 });
  }
}
