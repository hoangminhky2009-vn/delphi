/**
 * PFM — MÀN CAM KẾT: một luật "nếu–thì" do người chơi tự đặt.
 * **Làm theo DEMO ĐÃ CHỐT** (A11.25/D277): `#man-ck` của
 * `docs/ui-ux/demo/pfm-lo-trinh.html`. Chặng cuối của chuỗi
 * PHỎNG VẤN → LỘ TRÌNH → CAM KẾT (chỉ thị founder 08/09).
 *
 * ⚠⚠ Ô TIỀN ĐỂ TRỐNG LÀ **CHỖ APP TỪ CHỐI ĐIỀN**, không phải ô app quên.
 * Nguyên văn demo: *"App đề xuất số tiền là lúc nó thôi mô tả và bắt đầu kê
 * đơn."* A10 là ranh KHÔNG dẻo (A11.17) — đừng "điền tạm cho tiện".
 *
 * ⚠ MÔ HÌNH LUẬT DÙNG CHUNG VỚI MÀN GƯƠNG, không có bản thứ hai: cả hai gọi
 * `taoLuatMoi` + `MAU_LUAT`. Chỉ HÌNH khác nhau, và đó là chủ ý của demo — Gương
 * bày ba thẻ mẫu để chọn, màn này dựng MỘT CÂU có chip. Chép logic sang đây mới
 * là vi phạm A11.5; vẽ khác thì không.
 *
 * ⚠ Vì sao khối này đáng làm: câu "nếu … thì …" do chính người viết rồi được
 * nhắc lại đúng lúc là mảnh có bằng chứng mạnh nhất của cả tập nghiên cứu —
 * d ≈ 0,65 (Gollwitzer & Sheeran 2006, tổng hợp 94 nghiên cứu).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';
import { TabTaiChinh } from '@/components/pfm/TabTaiChinh';
import { NutCaiDatPfm } from '@/components/pfm/NutCaiDatPfm';
import { NeonButton } from '@/components/ui';
import { KhoProvider, useGhiKho, useHoSo } from '@/pfm/dung_kho';
import { DIEU_KIEN, canNguong, moLoiDoanLuat, suKienLuat, taoLuatMoi, type MaDieuKien } from '@/pfm/luat';
import { CHAC, type MaChac } from '@/pfm/vi_the';
import { thangSauCua } from '@/pfm/thoi_gian';
import { PFM } from '@config/pfm';
import { xepHang } from '@/pfm/dong_bo';
import { MAU_LUAT, mauTheoDieuKien } from '@/pfm/mau_luat';
import { dieuKienGoiY } from '@/pfm/cam_ket';
import { bayGio, sinhId, thangNay } from '@/pfm/thoi_gian';
import { CHU_DIEU_KIEN, CHU_LOI_GHI, CHU_THIEU_MUC, CHU_VI_THE as CV } from '@/lib/pfm_chu';
import { baoLoiNen } from '@/lib/telemetry';
import { ROUTE_TAI_CHINH_SO } from '@/lib/vocab';
import s from './CamKet.module.css';

/** ⚠ Xuất ra cho bài test — xem `RuotHu`/`RuotGuong`, cùng nếp. */
export function RuotCamKet() {
  const navigate = useNavigate();
  const ghi = useGhiKho();
  const { data: hoSo, dangTai } = useHoSo();

  /*
   * ĐIỀU KIỆN GỢI THEO CÂU 6 của phỏng vấn (founder: *"user chỉ cần sửa 1 tý"*).
   * ⚠ Đây là GỢI Ý có nguồn gốc, không phải lựa chọn của người chơi — nên chip
   * được gợi mang cờ ⚑ giống hệt chip "game điền sẵn" ở màn phỏng vấn. Lặng lẽ
   * chọn hộ rồi để nó trông như họ tự chọn mới là chỗ vượt ranh.
   */
  const goiY = useMemo(() => dieuKienGoiY(hoSo.nhip ?? []), [hoSo.nhip]);

  /*
   * `?dk=` — ĐIỀU KIỆN DO MÀN GỌI CHỈ ĐỊNH (D308): nút `XEM` của khối RÀO trên
   * lộ trình mở thẳng vào luật "hỏi lại tôi trước khoản > X". Người dùng vừa
   * bấm đúng khối ấy nên mở ra đúng nó, không bắt tìm lại.
   * ⚠ Mã lạ trong URL ⇒ BỎ QUA, không ném: query là thứ ai cũng gõ được.
   * ⚠ KHÔNG mang cờ ⚑ — cờ ấy nghĩa là "gợi theo câu 6", và chỉ `goiY` mới thế.
   */
  const [sp] = useSearchParams();
  const dkUrl = useMemo(() => {
    const x = sp.get('dk');
    return x !== null && (DIEU_KIEN as readonly string[]).includes(x) ? (x as MaDieuKien) : null;
  }, [sp]);

  const [dieuKien, setDieuKien] = useState<MaDieuKien>(dkUrl ?? goiY ?? 'ngay_chi_lon');
  const [loiNhac, setLoiNhac] = useState('');
  const [nguong, setNguong] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  /* Tệp 15 lát 1 — lời đoán cho THÁNG LIỀN SAU; tuỳ chọn, không chip nào sáng sẵn (P3). */
  const [chac, setChac] = useState<MaChac | null>(null);

  /*
   * Hồ sơ về muộn hơn lần render đầu ⇒ chỉnh lại gợi ý một lần, khi user chưa gõ gì.
   * ⚠ `dkUrl` THẮNG gợi ý: người dùng bấm một khối cụ thể để tới đây, còn gợi ý
   * chỉ là suy từ câu 6. Đảo thứ tự thì nút RÀO mở ra một luật khác hẳn.
   */
  useEffect(() => {
    if (dangTai || goiY === null || dkUrl !== null) return;
    setDieuKien((cu) => (loiNhac === '' ? goiY : cu));
  }, [dangTai, goiY, loiNhac, dkUrl]);

  const mau = mauTheoDieuKien(dieuKien) ?? MAU_LUAT[0]!;
  const loiHienTai = loiNhac === '' ? mau.loiNhacGoiY : loiNhac;
  const canSo = canNguong(dieuKien);

  async function dat() {
    if (dangLuu) return;
    setLoi(null);
    /*
     * ⚠ NGƯỠNG TRỐNG ⇒ TỪ CHỐI, KHÔNG "đoán một số cho tiện" — cùng luật mà màn
     * Gương đã chốt. Đây đúng là chỗ A10 dễ vỡ nhất trong cả app.
     */
    if (canSo && !/^\d{1,12}$/.test(nguong.trim())) {
      setLoi(CHU_THIEU_MUC);
      return;
    }
    setDangLuu(true);
    try {
      const luat = taoLuatMoi(
        {
          loiNhac: loiHienTai,
          dieuKien,
          ...(canSo ? { thamSo: { nguong: Number(nguong.trim()) } } : {}),
          mauId: loiNhac === '' ? mau.id : null,
        },
        bayGio(),
        sinhId(),
      );
      // ⚠ Lời đoán ở lại TRONG bản ghi luật (P2) — sự kiện `dat` vẫn chỉ chở ba trường (K5 🔒).
      const luatDat = chac !== null ? moLoiDoanLuat(luat, chac, luat.taoLuc) : luat;
      /*
       * ⚠ HAI VIỆC TRONG MỘT LƯỢT GHI, đúng như màn Gương làm: lưu luật VÀ xếp
       * hàng sự kiện. Quên vế thứ hai thì luật vẫn chạy trên máy nhưng ống nghiên
       * cứu KHÔNG BAO GIỜ biết có ai đặt luật — đúng lớp "đầy đủ ở một đầu, không
       * nối được sang đầu kia" mà `ho_so.ts` đã dính.
       * ⚠ Chỉ `{luat_id, mau_id, hanh_dong}` rời máy; CÂU LUẬT ở lại (P2 🔒).
       */
      const thang = thangNay();
      await ghi(['luat', 'outbox'], async (kho) => {
        await kho.ghi('luat', { id: luat.id, thang, suaLuc: luat.taoLuc, d: luatDat });
        await xepHang(kho, suKienLuat(luatDat, 'dat'), luat.taoLuc, luat.id, thang);
      });
      navigate(ROUTE_TAI_CHINH_SO, { replace: true });
    } catch (e) {
      setDangLuu(false);
      // D360 — câu chung; thông điệp `Error` là chuỗi lập trình, không đưa ra màn (C7 — xem `maLoi`).
      setLoi(CHU_LOI_GHI);
      baoLoiNen(e);
    }
  }

  return (
    <>
      <div className={s.the}>
        <p className={s.nhan}>MỘT LUẬT BẠN TỰ ĐẶT</p>
        <p className={s.giai}>
          Đây là mảnh có bằng chứng mạnh nhất trong cả tập nghiên cứu: câu{' '}
          <b>“nếu … thì …”</b> do chính bạn viết, rồi được nhắc lại đúng lúc —{' '}
          <b>d ≈ 0,65</b>, thuộc hàng lớn nhất của ngành hành vi. App không khuyên gì
          cả: lời là của bạn, app chỉ hỏi đúng câu và giữ lời hộ.
        </p>

        <div className={s.cau}>
          <span className={s.tu}>NẾU</span>
          <div className={s.chips} role="radiogroup" aria-label="Điều kiện">
            {DIEU_KIEN.map((dk) => (
              <button
                key={dk}
                type="button"
                role="radio"
                aria-checked={dieuKien === dk}
                className={`${s.chip} ${goiY === dk ? s.chipGoiY : ''}`}
                onClick={() => setDieuKien(dk)}
              >
                {CHU_DIEU_KIEN[dk]}
              </button>
            ))}
          </div>
        </div>

        {canSo && (
          <div className={s.cau}>
            <span className={s.tu}>MỨC</span>
            <input
              className={s.oMuc}
              inputMode="numeric"
              placeholder="— — —"
              aria-label="Mức tiền do bạn đặt"
              value={nguong}
              onChange={(e) => setNguong(e.target.value.replace(/\D/g, ''))}
            />
            <span className={s.donVi}>đ</span>
          </div>
        )}

        <label className={s.oLoi}>
          <span className={s.tu}>THÌ TỰ HỎI</span>
          <textarea
            className={s.oChu}
            rows={2}
            value={loiHienTai}
            onChange={(e) => setLoiNhac(e.target.value)}
          />
        </label>

        <div className={s.cau}>
          <span className={s.tu}>{`${CV.hoiLuatPre}${Number(thangSauCua(thangNay()).slice(5, 7))}${CV.hoiLuatHau}`}</span>
          <div className={s.chips} role="radiogroup" aria-label={CV.chacHoi}>
            {CHAC.map((c) => (
              <button
                key={c} type="button" role="radio" aria-checked={chac === c} className={s.chip}
                onClick={() => setChac((cu) => (cu === c ? null : c))}
              >
                {`${PFM.VI_THE_CHAC[c]}%`}
              </button>
            ))}
          </div>
        </div>

        <p className={s.khoiPhu}>
          ⚑ Ô để trống là <b>chỗ app từ chối điền</b>. App đề xuất số tiền là lúc nó
          thôi mô tả và bắt đầu kê đơn.
        </p>
        {goiY !== null && (
          <p className={s.khoiPhu}>
            Điều kiện có cờ ⚑ là gợi theo câu 6 bạn vừa trả lời — đổi thoải mái.
          </p>
        )}
        <p className={s.viSao}>{mau.viSao}</p>
      </div>

      <div className={s.the}>
        <p className={s.nhan}>KHI ĐIỀU KIỆN XẢY RA</p>
        <p className={s.giai}>Oracle hiện đúng một thẻ, không hơn:</p>
        <div className={s.loiNhacXem}>
          🗣️ <em>“Bạn tự dặn: {loiHienTai}”</em>
        </div>
        <p className={s.khoiPhu}>
          Vỡ luật <b>không bị phạt</b> — app chỉ ghi lại để bạn tự nhìn.
        </p>
      </div>

      {loi && <p className={s.loi} role="alert">✕ {loi}</p>}
      <div className={s.day}>
        <NeonButton type="button" block disabled={dangLuu} onClick={dat}>
          {dangLuu ? 'ĐANG LƯU…' : '▶ ĐẶT LUẬT NÀY'}
        </NeonButton>
        <button
          type="button"
          className={s.boQua}
          onClick={() => navigate(ROUTE_TAI_CHINH_SO, { replace: true })}
        >
          để sau, vào sổ trước
        </button>
      </div>
    </>
  );
}

export default function CamKet() {
  return (
    <ScreenFrame title="Cam kết" live goc={<NutCaiDatPfm />} gon>
      <TabTaiChinh />
      <KhoProvider>
        <RuotCamKet />
      </KhoProvider>
    </ScreenFrame>
  );
}
