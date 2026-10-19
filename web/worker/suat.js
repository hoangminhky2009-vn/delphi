/**
 * LUẬT SUẤT TRẬN — hàng chờ kiểu 2b2t cho `POST /api/v1/holdem/matches` (SPEC `docs/spec/tran-tran-ngay.md`).
 *
 * Cùng nếp `cong.js`: luật ở hàm thuần (test bằng vitest thường, không runtime Cloudflare — A8.9), sổ ở Durable Object
 * (`cua.js`, instance riêng `suat-v1` để không tranh nhịp với cổng vào app). Mọi SỐ ở `config/suat_tran.ts` (một nguồn với server).
 *
 * ─── KHÁC CỔNG D207 Ở ĐÂU ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Cổng D207 nhả theo GHẾ (người ra thì người vào) — chặn ĐỒNG THỜI. Thứ khoá Vercel 30 ngày là GB-giờ, tức số TRẬN, nên ở đây nhả
 * theo QUỸ: còn lại = quỹ luỹ kế tới giờ này − đã dùng hôm nay − đang giữ. Suất giờ trước thừa ⇒ tự cộng dồn (xem `quyLuyKe`).
 *
 * ─── SỔ ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *   ngay    — số thứ tự ngày VN của `daDung` (qua 0:00 ⇒ về 0)
 *   daDung  — số trận ĐÃ TẠO THẬT hôm nay (đếm bằng 201 của Vercel; lỗi không ăn suất)
 *   giu     — ve → hết hạn: đã nhả suất, đang chờ Vercel trả lời. Tính vào "đã tiêu" để hai người không cùng ăn một suất.
 *   cho     — FIFO { ve, han }: `han` = lúc rời hàng nếu im (theo nhịp hỏi ĐÃ BẢO họ + ân hạn) — không giữ chỗ ma.
 */
import { SUAT_TRAN, dauGioVN, gioVN, moLaiLuc, ngayVN, quyLuyKe } from '../../config/suat_tran.ts';

/** Sổ trống — dùng ở Durable Object lẫn test. */
export function soSuatTrong() {
  return { ngay: -1, daDung: 0, gioDung: -1, dungGio: 0, giu: new Map(), cho: [] };
}

/** Qua 0:00 giờ VN ⇒ quỹ ngày mới. Hàng chờ GIỮ NGUYÊN: người đứng chờ đêm qua đứng đầu sáng nay (2b2t). */
function capNhatNgay(st, now) {
  const n = ngayVN(now);
  if (st.ngay !== n) {
    st.ngay = n;
    st.daDung = 0;
    st.gioDung = -1;
    st.dungGio = 0;
  }
}

/** Dọn suất giữ quá hạn (Worker chết trước khi báo) + người chờ đã bỏ đi. Gọi TRƯỚC mọi phép đếm. */
function donDep(st, now) {
  for (const [ve, het] of st.giu) if (het <= now) st.giu.delete(ve);
  st.cho = st.cho.filter((m) => m.han > now);
}

/** Suất còn nhả được NGAY BÂY GIỜ. */
export function conLai(st, now, ch = SUAT_TRAN) {
  return Math.max(0, quyLuyKe(gioVN(now), ch) - st.daDung - st.giu.size);
}

/**
 * Người đứng thứ `viTri` (1 = đầu hàng) được nhả lúc nào: giờ VN SỚM NHẤT trong ngày mà quỹ luỹ kế đủ cho `viTri` người.
 * `null` ⇒ hôm nay không còn đủ suất cho vị trí này.
 */
function duKien(st, viTri, now, ch) {
  const daTieu = st.daDung + st.giu.size;
  const g = gioVN(now);
  if (quyLuyKe(g, ch) - daTieu >= viTri) return now;
  for (let h = g + 1; h <= 23; h += 1) {
    if (quyLuyKe(h, ch) - daTieu >= viTri) return dauGioVN(now, h);
  }
  return null;
}

/** Nhịp hỏi lại: ¼ quãng còn tới giờ dự kiến, kẹp [MIN, MAX] — xa thì thưa (ngân sách DO), gần thì dày. */
function nhipHoi(moc, now, ch) {
  const s = Math.ceil((moc - now) / 4000);
  return Math.min(ch.HOI_LAI_MAX_S, Math.max(ch.HOI_LAI_MIN_S, s));
}

/**
 * MỘT LƯỢT XIN SUẤT. Trả `{ vao: true }` (đã GIỮ một suất — Worker phải `baoKetQua` sau khi Vercel trả lời) hoặc
 * `{ vao: false, vi_tri, tong, du_kien, het_ngay, mo_lai_luc, hoi_lai_s }`.
 *
 * ⚠ KHÔNG CHEN HÀNG (cùng tính chất số 3 của `cong.js`): người mới chỉ được vào thẳng khi MỌI người đang đứng chờ cũng đủ suất
 *   (`cho.length < còn lại`); người trong hàng ở chỉ số i được vào khi i < còn lại. Người đến sau không bao giờ lấp suất của
 *   người đến trước — kể cả khi người trước chưa kịp hỏi lại.
 * ⚠ Hỏi lại KHÔNG làm tụt hạng: người đã trong hàng giữ nguyên chỗ, chỉ gia hạn.
 */
export function xinSuat(st, ve, now, ch = SUAT_TRAN) {
  capNhatNgay(st, now);
  donDep(st, now);

  // Đang giữ suất (bấm đúp / Worker hỏi lại) ⇒ vẫn là suất đó, không cấp suất thứ hai.
  if (st.giu.has(ve)) {
    st.giu.set(ve, now + ch.HAN_GIU_MS);
    return { vao: true };
  }

  const cl = conLai(st, now, ch);
  let i = st.cho.findIndex((m) => m.ve === ve);
  if ((i >= 0 && i < cl) || (i < 0 && st.cho.length < cl)) {
    if (i >= 0) st.cho.splice(i, 1);
    st.giu.set(ve, now + ch.HAN_GIU_MS);
    return { vao: true };
  }

  if (i < 0) {
    st.cho.push({ ve, han: 0 });
    i = st.cho.length - 1;
  }
  const viTri = i + 1;
  const moc = duKien(st, viTri, now, ch);
  const hetNgay = moc === null;
  const moLai = moLaiLuc(now);
  const hoiLai = nhipHoi(hetNgay ? moLai : moc, now, ch);
  st.cho[i].han = now + hoiLai * 1000 + ch.AN_HAN_CHO_MS;
  return {
    vao: false,
    vi_tri: viTri,
    tong: st.cho.length,
    du_kien: moc,
    het_ngay: hetNgay,
    mo_lai_luc: moLai,
    hoi_lai_s: hoiLai,
  };
}

/**
 * Vercel đã trả lời. `ok` = 201 THẬT ⇒ ăn một suất; lỗi (4xx/5xx/mạng) ⇒ trả suất về quỹ.
 * ⚠ 201 mà KHÔNG có suất giữ (hold đã quá hạn, DO vừa khởi động lại) VẪN đếm: trận đã tạo là đã đốt GB-giờ — đếm theo sự thật,
 *   không theo sổ giữ.
 */
export function baoKetQua(st, ve, ok, now) {
  capNhatNgay(st, now);
  st.giu.delete(ve);
  if (!ok) return;
  st.daDung += 1;
  const g = gioVN(now);
  if (st.gioDung !== g) { st.gioDung = g; st.dungGio = 0; }
  st.dungGio += 1;
}

/** Số cho `/admin`: "trận giờ này x / quỹ giờ · hôm nay y / quỹ ngày · đang chờ z". */
export function thongKe(st, now, ch = SUAT_TRAN) {
  capNhatNgay(st, now);
  donDep(st, now);
  const g = gioVN(now);
  return {
    gio_vn: g,
    dung_gio_nay: st.gioDung === g ? st.dungGio : 0,
    quy_gio: quyLuyKe(g, ch) - (g > 0 ? quyLuyKe(g - 1, ch) : 0),
    con_lai: conLai(st, now, ch),
    da_dung: st.daDung,
    quy_ngay: ch.QUY_NGAY,
    dang_giu: st.giu.size,
    dang_cho: st.cho.length,
  };
}
