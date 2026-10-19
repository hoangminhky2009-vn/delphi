/**
 * KHU TESTER — ĐỢT THỬ NGHIỆM, ĐỌC TỪNG NGƯỜI (D362).
 *
 * Founder 20/09: *"trên dashboard admin cũng có riêng 1 phần cho tester, thu chi tiết từng cá nhân"*.
 *
 * ⚠⚠ MẶT DUY NHẤT CỦA `/quan-tri` CÓ DÒNG THEO NGƯỜI. Mọi mặt khác giữ nguyên luật cũ (sàn mẫu, làm
 * tròn, không dòng theo người) vì chúng đọc NGƯỜI CHƠI THƯỜNG. Mặt này đọc người đã **tự chọn** vào
 * đợt thử nghiệm bằng link và đã bấm văn bản nói thẳng *"Nhóm làm app đọc dữ liệu của từng người"*.
 *
 * ⚠ Cột khoá là `ma_buoi_do` — đúng mã app tự điền vào ba Google Form (dải tester hiện nó là "MÃ CỦA
 * BẠN"). D392: trước đó cột khoá là `ma_tham_gia` (mã theo TRẬN), không nối được với bảng tính phiếu; nay
 * nó đứng cột thứ hai để lần theo trận. Không có tên, email hay id. Muốn biết "ai" thì phải hỏi chính
 * người ấy; dashboard không trả lời được câu đó, và đó là chủ đích.
 */
import { useState } from 'react';
import { NANG_LUC_HIEN } from '@config/nang_luc';
import { useDotThu, type DongTester } from '@/api/phantich';
import { TEN_NANG_LUC } from '@/lib/nang_luc';
import { Cho } from '@/screens/admin/Cho';
import s from '@/screens/admin/QuanTri.module.css';

const so = (v: number | null | undefined, hau = ''): string =>
  v === null || v === undefined ? '—' : `${Number(v).toLocaleString('vi-VN')}${hau}`;
/** Số thực gọn: hai chữ số sau dấu phẩy, và `—` khi chưa đo được (KHÔNG phải 0 — D62/A11.2). */
const le = (v: unknown, chu = 2): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(chu) : '—';
const pt = (v: unknown): string =>
  typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—';

/**
 * Bậc năng lực, theo mã server trả (D26: ID ở lõi, chữ ở vỏ). Chỉ năng lực đang HIỆN (`NANG_LUC_HIEN`, D396)
 * — N2 vẫn nằm trong CSV cho người đọc kỹ, không bày ở mặt nhìn nhanh này.
 */
const BAC_CHU: Record<string, string> = {
  chua_gap: 'chưa gặp', gap_chua_vung: 'chưa vững', lam_duoc: 'làm được', chung_minh: 'đã chứng minh',
};
const COT_BAC: ReadonlyArray<{ nhan: string; lay: (d: DongTester) => string; doi?: string }> = NANG_LUC_HIEN.map((id) => ({
  nhan: `BẬC ${TEN_NANG_LUC[id].ngan}`,
  lay: (d: DongTester) => {
    const b = d[`bac_${id}`];
    return typeof b === 'string' ? (BAC_CHU[b] ?? b) : '—';
  },
  doi: `Bậc thẻ của ĐÚNG trận này. Đối chiếu Phiếu 1 khối G (tự đánh giá trước khi chơi) và Phiếu 3 câu A1 `
    + `(họ chấm thẻ sau). "Chưa gặp" = đề không mở tình huống, KHÔNG phải yếu — loại khỏi phép so.`,
}));

/**
 * Một cột của bảng: tiêu đề, cách lấy giá trị, và CÂU ĐỐI CHIẾU với phiếu (hiện ở tooltip).
 * ⚠ D404 — tooltip gọi câu theo BA PHIẾU thật (`scripts/tao_form_buoi_do.ts`: Phiếu 1 TRƯỚC · 2 GIỮA · 3 SAU),
 *   không còn "Form 1–4" của bộ bốn tờ đã bỏ ở D367. Mã câu ở tooltip là `ma` trong bộ sinh.
 */
const COT: ReadonlyArray<{ nhan: string; lay: (d: DongTester) => string; doi?: string }> = [
  {
    nhan: 'MÃ BUỔI ĐO', lay: (d) => (d.ma_buoi_do ? d.ma_buoi_do.toUpperCase() : '—'),
    doi: 'Khoá ghép với bảng tính ba Google Form (cột MÃ BUỔI ĐO) — app tự điền mã này vào phiếu.',
  },
  {
    nhan: 'BƯỚC', lay: (d) => (d.buoc === null ? '—' : `${d.buoc}/5`),
    doi: '0 chưa nộp gì · 1 Phiếu 1 · 2 xong trận · 3 Phiếu 2 · 4 xong PFM · 5 Phiếu 3. Bước 1·3·5 là TỰ KHAI '
      + '(link quay về từ Form hoặc nút "đã nộp") — thứ tự thật đọc ở dấu thời gian của Form.',
  },
  { nhan: 'MÃ TRẬN', lay: (d) => d.ma_tham_gia },
  { nhan: 'ĐỢT', lay: (d) => d.dot || '—' },
  { nhan: 'ĐỀ', lay: (d) => d.de_id ?? '—' },
  {
    nhan: 'NHÓM TUỔI', lay: (d) => d.nhom_tuoi ?? '—',
    doi: 'Dạng khoảng từ hồ sơ. Phiếu không hỏi nhân khẩu học — cột này là chỗ duy nhất có.',
  },
  { nhan: 'HẠNG', lay: (d) => (d.hang === null ? '—' : `${d.hang}/${so(d.so_ghe)}`) },
  { nhan: 'VỐN CUỐI', lay: (d) => so(d.von_cuoi) },
  {
    nhan: 'BRIER',
    lay: (d) => le(d.brier_tb),
    doi: 'Thấp = tốt; mốc oracle ≈ 0,48 · bấm bừa ≈ 1,06. KHÔNG có câu phiếu tương ứng. ⚠ Đề ô NGỬA (v45/v52): '
      + 'Brier đo tốc độ đọc bảng, chưa phải dự báo (D373) — đừng ghép với tám câu đố Phiếu 1.',
  },
  {
    nhan: 'GIỮ SỔ',
    // ⚠ Chưa gửi tiết kiệm lần nào ⇒ MỘT dấu `—`, không phải `— · huỷ —`: hai gạch cạnh nhau đọc như
    //   hai phép đo cùng hỏng, trong khi sự thật là người đó chưa đi qua cơ chế ấy.
    // D404 — "huỷ" là TỔNG số lần (`tk_huy_so_tong`), không phải max theo vòng.
    lay: (d) => (d.tiet_kiem_bp === null && d.tk_huy_so_tong === null
      ? 'chưa gửi' : `${so(d.tiet_kiem_bp)} · huỷ ${so(d.tk_huy_so_tong)}`),
    doi: 'Tỷ trọng gửi cao nhất · số lần rút sớm. Đối chiếu Phiếu 1 khối G dòng 1 và Phiếu 2 câu b1 (ô "rút sổ trước hạn").',
  },
  ...COT_BAC,
  {
    nhan: 'PHƠI NHIỄM',
    lay: (d) => pt(d.phoi_nhiem_tb),
    doi: 'Phần NAV nằm ngoài tiền mặt, trung bình các vòng. Đối chiếu Phiếu 1 câu H (rủi ro tự khai 0–10) — '
      + 'GIẢ THUYẾT loại B, chỉ so cùng đề và cùng vai.',
  },
  {
    nhan: 'BẤM TỰ ĐỘNG',
    lay: (d) => `${so(d.vong_tu_dong)}/${so(d.so_vong)}`,
    doi: 'Số vòng hết giờ máy chốt hộ. Đối chiếu Phiếu 2 câu a3 ("bấm mà chưa kịp nghĩ"). Đọc kèm cột LỖI và MS QUYẾT — '
      + 'nút CHỐT kẹt (lỗi đã biết) cũng thành "tự động".',
  },
  {
    nhan: 'MS QUYẾT',
    lay: (d) => (typeof d.ms_quyet_tb === 'number' ? `${Math.round(d.ms_quyet_tb / 100) / 10}s` : '—'),
    doi: 'Giây từ lúc vòng mở tới lúc chốt, trung bình các vòng có bấm. Vòng 1 gộp cả pha nhận vai.',
  },
  {
    nhan: 'SỔ: NGÀY GHI',
    lay: (d) => le(d.hv_ngay_co_ghi, 0),
    doi: 'Chỉ có số khi họ tự bật cửa chia sẻ PFM — với tester thường TRỐNG (đúng thiết kế, D396).',
  },
  {
    nhan: 'TELEMETRY',
    lay: (d) => (d.ghi_telemetry === true ? 'có' : d.ghi_telemetry === false ? 'không' : '—'),
    doi: 'Ô "đồng ý nghiên cứu" lúc lập hồ sơ (mặc định KHÔNG tick). Không tick thì THOÁT Ở VÒNG · MÀN CUỐI · LỖI '
      + 'trống — trống vì không ghi, không phải vì không xảy ra.',
  },
  {
    nhan: 'THOÁT Ở VÒNG',
    lay: (d) => d.app_thoat_vong ?? '—',
    doi: 'Đối chiếu Phiếu 2 câu e3 ("chán nhất lúc nào"). Cần cột TELEMETRY = có.',
  },
  { nhan: 'MÀN CUỐI', lay: (d) => d.app_man_cuoi ?? '—' },
  { nhan: 'LỖI', lay: (d) => so(d.app_so_loi_client) },
];

export function Tester() {
  const [dot, datDot] = useState<string | null>(null);
  const truyVan = useDotThu(dot);

  return (
    <Cho
      q={truyVan}
      con={truyVan.data ? (
        <div>
          <div className={s.khoi}>
            <h3 className={s.khoiTieuDe}>ĐỢT THỬ NGHIỆM — TỪNG NGƯỜI MỘT DÒNG</h3>
            <p className={s.mo}>
              Chỉ người vào bằng <b>link bàn buổi đo</b> và đã bấm đồng ý ở bản văn bản đang chạy
              (<code>{truyVan.data.consent_ban}</code>). Khoá là <b>MÃ BUỔI ĐO</b> — đúng mã app tự điền vào ba
              Google Form, nên hai bảng ghép thẳng được. Không có tên, email hay id ở đây.
            </p>

            <div className={s.luoi}>
              <div className={s.o}>
                <div className={s.oNhan}>ĐANG TRONG ĐỢT</div>
                <div className={s.oGt}>{so(truyVan.data.thong_ke.dong_y)}</div>
                <div className={s.oPhu}>
                  {truyVan.data.thong_ke.loai_ban_cu > 0
                    ? `⚠ ${truyVan.data.thong_ke.loai_ban_cu} người bật cờ nhưng chưa khớp bản văn bản`
                    : 'tất cả đều khớp bản văn bản'}
                </div>
              </div>
              <div className={s.o}>
                <div className={s.oNhan}>TRẬN BUỔI ĐO</div>
                <div className={s.oGt}>{so(truyVan.data.thong_ke.tran)}</div>
                <div className={s.oPhu}>đã dựng hành vi {so(truyVan.data.thong_ke.tran_da_dung)}</div>
              </div>
              <div className={s.o}>
                <div className={s.oNhan}>VÒNG ĐÃ GHI</div>
                <div className={s.oGt}>{so(truyVan.data.vong.length)}</div>
                <div className={s.oPhu}>dòng dữ liệu bảng</div>
              </div>
            </div>

            {truyVan.data.cac_dot.length > 1 ? (
              <p className={s.mo} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <span>Đợt:</span>
                <button type="button" className={s.rayNut} aria-current={dot === null}
                  onClick={() => datDot(null)}>TẤT CẢ</button>
                {truyVan.data.cac_dot.map((x) => (
                  <button key={x.nhan ?? '—'} type="button" className={s.rayNut} aria-current={dot === x.nhan}
                    onClick={() => datDot(x.nhan)}>{x.nhan ?? '(không nhãn)'} · {x.n}</button>
                ))}
              </p>
            ) : null}
          </div>

          <div className={s.khoi}>
            {truyVan.data.nguoi.length === 0 ? (
              <p className={s.mo}>
                Chưa ai trong đợt. Người chơi vào bằng link bàn buổi đo và bấm ĐỒNG Ý VÀ VÀO thì dòng của họ
                hiện ở đây — không cần bật tay gì thêm.
              </p>
            ) : (
              <>
                {/* ⚠ Bảng rộng hơn màn hình là bình thường; nó cuộn trong hộp của chính nó, không đẩy cả trang. */}
                <div style={{ overflowX: 'auto' }}>
                  <table className={s.bang}>
                    <thead>
                      <tr>{COT.map((c) => (
                        <th key={c.nhan} title={c.doi ?? undefined}>
                          {c.nhan}{c.doi ? ' *' : ''}
                        </th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {truyVan.data.nguoi.map((d, i) => (
                        <tr key={`${d.ma_tham_gia}-${i}`}>
                          {/* D404 soi mắt: 20 cột — ô KHÔNG xuống dòng ("0 · huỷ 0" từng gãy làm hai), bảng cuộn ngang trong hộp. */}
                          {COT.map((c) => <td key={c.nhan} style={{ whiteSpace: 'nowrap' }}>{c.lay(d)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={s.mo}>
                  Cột có dấu <b>*</b> có câu đối chiếu bên Google Form — di chuột lên tiêu đề cột để đọc câu nào.
                  Bảng đầy đủ mọi cột (kể cả dữ liệu theo vòng) xuất bằng{' '}
                  <code>npm run buoi-do:xuat:prod -- &lt;mã bàn&gt;</code>.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    />
  );
}
