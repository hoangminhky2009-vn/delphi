/**
 * PFM — MÀN LỘ TRÌNH. **Làm theo DEMO ĐÃ CHỐT** (A11.25/D277): `#man-lt` của
 * `docs/ui-ux/demo/pfm-lo-trinh.html`.
 *
 * Đứng giữa PHỎNG VẤN và CAM KẾT (chỉ thị founder 08/09: *"phỏng vấn xong dẫn
 * thẳng sang lộ trình, lộ trình xong thì đến phần đặt cam kết"*).
 *
 * ⚠ A10 🔒 — app ghép HÌNH, người chơi điền SỐ. Không một khối nào ở đây chứa
 * con số tiền; mức của hũ luôn là "do bạn đặt". Mọi chữ đến từ `pfm/lo_trinh.ts`
 * (khối tĩnh có mã), màn này chỉ VẼ.
 *
 * ⚠ Cổng chặng đếm VIỆC ĐÃ LÀM, không đếm ngày — và "MỞ HẾT" không bị chặn, chỉ
 * được nói trước hậu quả. Demo: *"Không ai chặn bạn — chỉ nói trước cho đúng."*
 *
 * ⚠ D308 — BẢY NÚT KIA GIỜ ĐI ĐƯỢC. Bản D306 chỉ nối `ĐẶT CAM KẾT`; sáu nút còn
 * lại bấm vào không có gì xảy ra, đúng họ lỗi "ngõ cụt" 07/09. Bảng đích ở
 * `pfm/lo_trinh.ts` §`DICH_NUT` (một nguồn, có bài canh); màn này chỉ thi hành.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';
import { TabTaiChinh } from '@/components/pfm/TabTaiChinh';
import { NutCaiDatPfm } from '@/components/pfm/NutCaiDatPfm';
import { BoardCaiDatPfm } from '@/components/pfm/BoardCaiDatPfm';
import { NeonButton } from '@/components/ui';
import { KhoProvider, useGhiKho, useHoSo, useHu, useSoTatCa } from '@/pfm/dung_kho';
import { trangThaiTaiChinh } from '@/pfm/trang_thai';
import { DICH_NUT, loTrinh, tomTatLoTrinh } from '@/pfm/lo_trinh';
import { soCauDaTraLoi, suaHoSo, type HoSo, type MaKhung } from '@/pfm/ho_so';
import { baoLoiNen } from '@/lib/telemetry';
import { CHU_LOI_GHI } from '@/lib/pfm_chu';
import { bayGio } from '@/pfm/thoi_gian';
import { CAU_PV } from '@/pfm/phong_van';
import { useNangLuc, useTinhCach } from '@/api/tinh_cach';
import { useCuaPfm } from '@/api/pfm';
import { CHU_NANG_LUC, TEN_NANG_LUC } from '@/lib/nang_luc';
import { useMe } from '@/api/queries';
import { giongCua, theCua, type GiongChon } from '@/lib/tinh_cach';
import { ROUTE_TAI_CHINH_CAM_KET, ROUTE_TAI_CHINH_SO } from '@/lib/vocab';
import s from './LoTrinh.module.css';

/**
 * D324 — MỘT DÒNG "TỪ TRẬN": năng lực người chơi ĐÃ LÀM ĐƯỢC trên các đề đã xong (thẻ năng
 * lực D323), chỉ khi cửa `noi_game` mở. Chỉ nêu cái đã làm được, không nêu cái chưa — lộ
 * trình là chỗ vẽ đường, không phải bảng điểm (A10). Không có gì để nêu ⇒ im.
 */
export function TuTran(): React.ReactElement | null {
  const noiGame = useCuaPfm()?.noi_game === true;
  const nl = useNangLuc(noiGame);
  if (!noiGame || !nl.data) return null;
  const daLam = nl.data.nang_luc.filter((n) => n.bac === 'lam_duoc' || n.bac === 'chung_minh');
  if (daLam.length === 0) return null;
  return (
    <p className={s.tomTat} data-testid="tu-tran">
      {CHU_NANG_LUC.tuTranPre}{daLam.map((n) => TEN_NANG_LUC[n.id].ngan.toLowerCase()).join(' · ')}.
    </p>
  );
}

/** ⚠ Xuất ra cho bài test — bản mặc định tự mở IndexedDB thật; test bơm kho của mình. */
export function RuotLoTrinh() {
  const navigate = useNavigate();
  const ghi = useGhiKho();
  const { data: hoSo, sanSang: coHoSo } = useHoSo();
  const { data: so } = useSoTatCa();
  const me = useMe();
  const tc = useTinhCach(true);
  const giong = giongCua(
    me.data?.user?.age_band, me.data?.user?.giong_ho_so as GiongChon | undefined,
  );
  const [moHet, setMoHet] = useState(false);
  const [moChang, setMoChang] = useState<string | null>('1');
  const [moCaiDat, setMoCaiDat] = useState(false);
  // 13/09 — lời giới thiệu và chú thích từng khối nằm sau nút (?), mặc định đóng.
  const [moGioiThieu, setMoGioiThieu] = useState(false);
  const [moKhoi, setMoKhoi] = useState<string | null>(null);
  /** Câu báo khi cú ghi hồ sơ hỏng — xem `suaTuKho`. `null` = không có gì để nói. */
  const [loiGhi, setLoiGhi] = useState<string | null>(null);

  /*
   * D325 — lộ trình đọc SỔ, không chỉ đọc lời khai. ⚠ Đang tải hũ ⇒ `null`, không phải "không
   * có hũ": đưa mảng rỗng của nhịp render đầu vào là khối "không có hũ dự phòng" loé lên rồi
   * biến mất với người đã có hũ — app nói sai về sổ của họ trong nửa giây.
   */
  /*
   * ⚠ D360 — `sanSang` chứ không phải `!dangTai`. Cùng lỗ đã vá cho hồ sơ: `dangTai = isPending && kho !== null`
   * nên trong lúc kho ĐANG MỞ nó là `false` với `hu = []` ⇒ `trangThaiTaiChinh` chạy trên một cái sổ RỖNG chưa ai
   * đọc, và khối "sổ của bạn đang không có hũ dự phòng nào mở" loé lên với người ĐANG CÓ hũ. Ca ấy có thật dù cổng
   * `coHoSo` đã chặn cả màn: đi từ màn PFM khác sang thì hồ sơ nằm sẵn trong cache (`gcTime: Infinity`) mà kho của
   * provider MỚI thì vẫn đang mở — hồ sơ sẵn sàng, hũ thì chưa.
   */
  const { data: hu, sanSang: coHu } = useHu();
  const tt = useMemo(() => (coHu ? trangThaiTaiChinh(hu, hoSo) : null), [coHu, hu, hoSo]);
  const chang = useMemo(() => loTrinh(hoSo, so, moHet, tt), [hoSo, so, moHet, tt]);

  /*
   * ⚠⚠ MỌI CÚ GHI HỒ SƠ CỦA MÀN NÀY ĐI QUA ĐÂY, VÀ NÓ KHÔNG BAO GIỜ ĐỌC `hoSo` CỦA STATE (D360). `hoSo` ở trên là
   * thứ để VẼ: nó là `{}` khi chưa nạp xong và là bản CŨ giữa một cú ghi với lượt nạp lại sau nó. Bản lên prod từ
   * 0.0.5 dựng `{ ...hoSo, loTrinhBo: […] }` từ chính state ấy rồi ghi đè trọn bản ghi ⇒ chạm BỎ sớm là sáu câu
   * phỏng vấn bay sạch, im lặng; hai cú chạm sát nhau là cú sau nuốt cú trước. Phép sửa giờ chạy trên bản ĐỌC TỪ
   * KHO và XẾP HÀNG (`ho_so.ts` §`suaHoSo` — một nguồn, A11.5); bài canh: `lo_trinh_nut.test.tsx` §VI.
   * ⚠ `f` trả `null` (không có gì để sửa) thì `ghi` VẪN vô hiệu hoá `meta` — có chủ ý: tới được nhánh ấy nghĩa là
   *   state của màn đang cũ hơn kho, nên đọc lại là đúng việc cần làm.
   */
  async function suaTuKho(f: (cu: HoSo) => HoSo | null): Promise<void> {
    setLoiGhi(null);
    try {
      await ghi(['meta'], (kho) => suaHoSo(kho, f, bayGio()));
    } catch (e) {
      /*
       * ⚠ BÁO CHO NGƯỜI DÙNG, rồi mới để lại dấu cho người vận hành (D360). Trước bản này cú ghi hỏng đi vào
       * `void` ⇒ không chữ, không log, không đếm được: người dùng chỉ thấy "bấm không ăn" nên không ai báo lại.
       * Câu chữ ở `pfm_chu.ts` §`CHU_LOI_GHI` — một nguồn cho mọi màn PFM.
       */
      setLoiGhi(CHU_LOI_GHI);
      baoLoiNen(e);
    }
  }

  /**
   * MỘT CỬA cho mọi nút của mọi khối — bảng đích ở `pfm/lo_trinh.ts`, màn này
   * chỉ THI HÀNH. Nút lạ (không có trong bảng) thì KHÔNG làm gì, và bài canh
   * `lo_trinh.test.ts` đảm bảo không có nút lạ nào tồn tại.
   */
  async function bamNut(nhanNut: string, khoi: { nhan?: string; khung?: MaKhung }): Promise<void> {
    const dich = DICH_NUT[nhanNut];
    if (dich === undefined) return;
    if (dich.kieu === 'di') { navigate(dich.den); return; }
    if (dich.ma === 'cai_dat') { setMoCaiDat(true); return; }
    if (dich.ma === 'thu_khung') {
      // D325 — ĐỒNG Ý thì ghi đúng `khung`, không gì khác (không mở hũ, không đặt số hộ).
      const khung = khoi.khung;
      if (khung === undefined) return;
      await suaTuKho((cu) => ({ ...cu, khung }));
      return;
    }
    // 'bo_khoi' — chỉ khối hũ mới có nhãn; không nhãn thì không biết bỏ cái gì.
    const nhan = khoi.nhan;
    if (nhan === undefined) return;
    // "Đã bỏ rồi" kiểm trên bản CỦA KHO: kiểm trên state rồi nối vào bản của kho là ra hai khoá trùng.
    await suaTuKho((cu) => {
      const daBo = cu.loTrinhBo ?? [];
      return daBo.includes(nhan) ? null : { ...cu, loTrinhBo: [...daBo, nhan] };
    });
  }

  const the = tc.data ? theCua(tc.data.tinh_cach, giong) : null;
  /* Đếm từ chính hồ sơ — luật đếm ở `ho_so.ts` §`soCauDaTraLoi`, MỘT nguồn với màn NGÀY ĐẦU (A11.5, D358). */
  const soCau = useMemo(() => soCauDaTraLoi(hoSo), [hoSo]);

  /*
   * D360 — CHƯA CÓ HỒ SƠ THÌ KHÔNG VẼ GÌ BẤM ĐƯỢC. Trước đó màn vẽ ngay lộ trình của hồ sơ RỖNG (khối "CHỌN MẪU",
   * "0/6 câu") rồi nửa giây sau đổi sang bản thật — kể sai lời khai của người dùng, cùng họ với cú loé "không có hũ
   * dự phòng" mà cổng `taiHu` ở trên chặn (D325) — và mọi nút vẽ ra lúc ấy đều đứng trên dữ liệu rỗng.
   * ⚠ Cổng là `sanSang`, KHÔNG phải `dangTai`/`dangMo` — lý do ở `dung_kho.tsx` §`useHoSo`: `dangTai` hở cửa sổ kho
   *   đang mở, còn `dangMo` thì làm nháy một khung trắng ở MỌI lần chuyển màn dù hồ sơ có sẵn trong cache.
   * ⚠ Đứng SAU mọi hook (luật hook), và chỉ chờ HỒ SƠ: khối đọc từ sổ vẫn theo nếp `taiHu` (đang tải ⇒ chưa vẽ
   *   khối ấy) — chờ thêm cả sổ là bắt người có sổ dày nhìn khung trắng lâu hơn để đổi lấy một khối.
   */
  if (!coHoSo) return <div data-testid="man-lo-trinh" aria-busy="true" />;

  return (
    <>
      <div className={s.the}>
        {/*
          13/09 — LỜI GIỚI THIỆU + LUẬT CỔNG CHẶNG LÊN NÚT (?). Founder: *"chữ thì chỉ dành cho bách
          khoa toàn thư"* — trước đó màn này 303 chữ, năm đoạn văn, 1503px. Ngoài vẫn còn hai thứ đóng
          khung "mẫu, không phải lời phán": nhãn SỬA ĐƯỢC HẾT và dòng "Ghép từ thẻ … + n câu".
        */}
        <div className={s.nhanHang}>
          <p className={s.nhan}>LỘ TRÌNH CỦA BẠN · SỬA ĐƯỢC HẾT</p>
          <button
            type="button" className={s.hoi} aria-expanded={moGioiThieu} aria-label="Lộ trình này là gì"
            onClick={() => setMoGioiThieu((v) => !v)}
          >
            {moGioiThieu ? '✕' : '?'}
          </button>
        </div>
        {moGioiThieu && (
          <>
            <p className={s.giai}>
              App ghép <b>HÌNH</b>, bạn điền <b>SỐ</b>. Mọi khối dưới đây là mẫu tĩnh có mã
              số, chọn theo thẻ tính cách + {CAU_PV.length} câu bạn vừa trả lời — không có
              câu nào sinh tự do, và app <b>không tự điền một con số tiền nào</b>. Đổi, thêm,
              xoá khối nào cũng được; mẫu là điểm xuất phát, không phải cái lồng.
            </p>
            <p className={s.giai}>
              Cổng của mỗi chặng đếm <b>việc bạn đã làm</b>, không đếm ngày. Nhập một tháng cũ
              trong một tối là mở ngay tối đó.
            </p>
          </>
        )}
        <p className={s.tomTat} data-testid="tom-tat">
          {tomTatLoTrinh(hoSo, the ? the.ten : null, soCau)}
        </p>
        <TuTran />
      </div>

      <div data-testid="ds-chang">
        {chang.map((c) => {
          const mo = c.mo;
          const dangXem = moChang === c.so;
          return (
            <div key={c.so} className={`${s.chang} ${mo ? '' : s.changKhoa}`}>
              <button
                type="button"
                className={s.changDau}
                aria-expanded={dangXem}
                onClick={() => setMoChang(dangXem ? null : c.so)}
              >
                <span className={s.changSo}>{c.so}</span>
                <span className={s.changTen}>{c.ten}</span>
                <span className={mo ? s.changTrang : s.changKhoaNhan}>
                  {c.cong === null ? 'ĐANG MỞ' : (mo ? 'MỞ' : `${c.cong.co}/${c.cong.can}`)}
                </span>
              </button>

              {dangXem && (
                <div className={s.changRuot}>
                  {c.cong !== null && !mo && (
                    <p className={s.cong}>
                      Cần <b>{c.cong.can}</b> {c.cong.nhan} — đang có <b>{c.cong.co}</b>.
                      <br />
                      <span className={s.congVi}>{c.cong.vi}</span>
                    </p>
                  )}
                  {c.khoi.map((k) => {
                    const khoa = `${c.so}:${k.ma}:${k.nhan ?? ''}`;
                    const moi = moKhoi === khoa;
                    return (
                    <div key={`${k.ma}:${k.nhan ?? ''}`} className={s.khoi} data-ma={k.ma}>
                      <div className={s.khoiDau}>
                        <span className={s.khoiMa}>{k.ma}</span>
                        <span className={s.khoiTen}>{k.ten}</span>
                        <button
                          type="button" className={s.hoi} aria-expanded={moi} aria-label={`Về khối ${k.ten}`}
                          onClick={() => setMoKhoi(moi ? null : khoa)}
                        >
                          {moi ? '✕' : '?'}
                        </button>
                      </div>
                      {/* Dòng mô tả + dòng VÌ SAO: không bỏ, chỉ nằm sau nút (xem `.khoiVi`). */}
                      {moi && (
                        <>
                          <p className={s.khoiPhu}>{k.phu}</p>
                          <p className={s.khoiVi}>{k.vi}</p>
                        </>
                      )}
                      <div className={s.khoiNut}>
                        {k.nut.map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={s.nutNho}
                            // ⚠ `.catch` chứ không `void` (D360): cú ghi hỏng mà vứt lời hứa đi là hỏng IM LẶNG hoàn toàn.
                            onClick={() => { bamNut(n, k).catch(baoLoiNen); }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={s.moHet}
        aria-pressed={moHet}
        onClick={() => setMoHet((v) => !v)}
      >
        MỞ HẾT — TÔI BIẾT TÔI ĐANG LÀM GÌ
      </button>
      {moHet && (
        <p className={s.canh}>
          Mở hết bây giờ thì hai chặng sau vẫn dùng được, nhưng gương sẽ nói{' '}
          <b>“chưa đủ để nói”</b> ở gần hết các dòng, và luật sẽ chưa có gì để bắn.
          Không ai chặn bạn — chỉ nói trước cho đúng.
        </p>
      )}

      {loiGhi && <p className={s.loi} role="alert">✕ {loiGhi}</p>}
      <div className={s.day}>
        <NeonButton type="button" block onClick={() => navigate(ROUTE_TAI_CHINH_CAM_KET)}>
          ▶ TIẾP — ĐẶT MỘT CAM KẾT
        </NeonButton>
        <button type="button" className={s.boQua} onClick={() => navigate(ROUTE_TAI_CHINH_SO)}>
          để sau, vào sổ trước
        </button>
      </div>

      {/*
        Nút TẮT NHẮC mở ĐÚNG board mà bánh răng ⚙ mở — công tắc `nhacTat` chỉ có
        một bản (khối ⑥ `CaiDatPfm`). Một board thứ hai chỉ để chứa một công tắc
        là đúng thứ A11.5 cấm.
      */}
      {moCaiDat && <BoardCaiDatPfm onDong={() => setMoCaiDat(false)} />}
    </>
  );
}

export default function LoTrinh() {
  return (
    <ScreenFrame title="Lộ trình" live goc={<NutCaiDatPfm />} gon>
      <TabTaiChinh />
      <KhoProvider>
        <RuotLoTrinh />
      </KhoProvider>
    </ScreenFrame>
  );
}
