/**
 * PFM — KHỐI "SỔ CHI TIÊU" TRONG CÀI ĐẶT: bốn cửa consent + mã khôi phục + két + xoá sạch.
 * **Làm theo DEMO ĐÃ CHỐT** (A11.25): `docs/ui-ux/demo/pfm-cai-dat.html`, bản D295 — sáu
 * khối, đúng thứ tự ①…⑥, chữ chép nguyên qua `pfm_chu.ts`.
 *
 * ⚠⚠ ĐÂY LÀ CỬA DUY NHẤT NGƯỜI DÙNG CHẠM VÀO CONSENT (D295): bốn công tắc riêng, mỗi cú
 * bật gửi văn bản CỦA ĐÚNG CỬA ẤY (`vanBanCua`) và phiên bản từ `CONSENT_PHIEN_BAN` — không
 * gõ tay ở đây một chuỗi nào. Công tắc chung chỉ là LỐI TẮT của màn: nó bấm bốn cửa
 * TUẦN TỰ theo `CUA_PFM`, dừng ở lỗi đầu tiên và nói ra; server vẫn nhận bốn cú, bốn vết.
 *
 * ⚠⚠ P2 🔒 — mọi thứ về chìa chạy TRÊN MÁY: mã do máy sinh (`taoMaKhoiPhuc`), chìa rèn
 * bằng PBKDF2 (`suyKhoa`), cất vào kho dưới dạng `CryptoKey` không trích được (`catChia`
 * — structured clone, KHÔNG JSON: `JSON.stringify(CryptoKey)` là `{}`, D264). Server chỉ
 * thấy ciphertext. Màn này không có đường nào gửi mã đi, và không được có.
 *
 * ⚠ KHOÁ theo demo: ② và ④ mở khi cửa SAO LƯU KÉT bật; ③ còn đòi thêm chìa đã rèn;
 *   ⑤ KHÔNG BAO GIỜ khoá — quyền xoá không phụ thuộc đồng ý (`POST /xoa` không canh cửa).
 * ⚠ LED tiến trình chạy bằng `setTimeout`, KHÔNG `requestAnimationFrame`: rAF đứng im khi
 *   khung bị ẩn (đo ở D294), mà rèn chìa/sao lưu vẫn phải chạy tới cùng.
 * ⚠ Trạng thái bốn cửa đọc từ `/me` (`useCuaPfm`), không giữ bản riêng: server là nguồn,
 *   màn chỉ hiển thị (C4). Sau mỗi cú đổi, `useDoiCua` làm tươi `/me`.
 */
import {
  useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PointerEventReact,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CONSENT_PHIEN_BAN, CUA_PFM, vanBanCua, type CuaPfm } from '@config/pfm_consent';
import { queryKeys, useMe } from '@/api/queries';
import { useCuaPfm, useDoiCua, xoaSachPfm } from '@/api/pfm';
import { ID_CAI_DAT_MAY, CAI_DAT_MAY_MAC_DINH, type CaiDatMay } from '@/pfm/cai_dat_may';
import { KHOA_PFM, useGhiKho, useKho, useXoaSachKho } from '@/pfm/dung_kho';
import type { KhoPfm } from '@/pfm/kho';
import { DAI_MA, chuanMa, mocMa, suyKhoa, taoMaKhoiPhuc } from '@/pfm/ket';
import { ID_KHOA_KET, catChia, docChia, muoiCuaUser, taoVaLuuChia } from '@/pfm/ket_may';
import {
  khoiPhucTuKet, latDeKhoiPhuc, saoLuuMotLuot, type KetQuaKhoiPhuc,
} from '@/pfm/ket_chay';
import { bayGio, homNay, thangNay } from '@/pfm/thoi_gian';
import { CHU_CAI_DAT, CHU_CONSENT_KHOI, CHU_VUONG, VAN_BAN_CONSENT } from '@/lib/pfm_chu';
import { rung } from '@/lib/rung';
import { useDangThaoTac } from '@/lib/thao_tac';
import s from './CaiDatPfm.module.css';

/* ═══ hằng của demo ═════════════════════════════════════════════════════════ */

/** N ô LED sáng lần lượt — demo `chayLed(N = 10)`. */
export const SO_O_LED = 10;
/** LED chạy trọn trong 1,5 s (demo) — việc thật (PBKDF2 · mạng) chạy song song, xong muộn hơn thì LED đứng đầy chờ. */
export const LED_MS = 1500;
/** Giữ 2 giây để xoá (demo `GIU_MS`). */
export const GIU_XOA_MS = 2000;
const GIU_BUOC_MS = 50;
/** Con dấu "ĐÃ XOÁ SẠCH" đứng 2,6 s rồi nút trở lại nhãn cũ (demo). */
const DAU_XOA_MS = 2600;
const TOAST_MS = 1800;


/*
 * Hai khoá react-query dưới tiền tố `['pfm','meta']` — để `useGhiKho(['meta'])` làm tươi
 * chúng, và `useXoaSachKho` (reset `['pfm']`) quét luôn.
 */
const KHOA_CHIA = [...KHOA_PFM.ngan('meta'), ID_KHOA_KET] as const;
const KHOA_CAI_DAT_MAY = [...KHOA_PFM.ngan('meta'), ID_CAI_DAT_MAY] as const;

/** Nhịp — CHỈ để test rút ngắn; mặc định là số của demo. Không đổi một pixel nào. */
export interface NhipCaiDat { ledMs?: number; giuMs?: number }

/** `'HH:MM'` theo Asia/Ho_Chi_Minh (A8.8) từ một mốc ISO của `thoi_gian.ts`. */
function gioHienThi(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('vi-VN',
      { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}

function bonTat(): Record<CuaPfm, boolean> {
  const ra = {} as Record<CuaPfm, boolean>;
  for (const k of CUA_PFM) ra[k] = false;
  return ra;
}

/* ═══ LED nhịp máy dùng chung — `setTimeout`, không rAF ═══════════════════ */

/**
 * `sang === null` = LED ẩn; `0…SO_O_LED` = số ô đang sáng. `chay(viec)` chạy việc thật
 * SONG SONG với dải LED; trả kết quả của việc khi CẢ HAI xong.
 * ⚠ Việc hỏng giữa chừng ⇒ dừng tick (cờ `huy`), không thì các tick còn lại bật LED
 *   dậy sau khi đã ẩn.
 */
function useLed(ms: number): {
  sang: number | null;
  chay: <T>(viec: () => Promise<T>) => Promise<T>;
} {
  const [sang, datSang] = useState<number | null>(null);
  /*
   * ⚠⚠ ĐẶT `true` TRONG THÂN EFFECT, không chỉ ở giá trị khởi tạo của ref. StrictMode
   * (dev) chạy mount → cleanup → mount: cleanup đặt `false`, còn ref thì KHÔNG khởi tạo lại
   * — nên bản đầu (`useRef(true)` + cleanup) làm cờ này chết `false` vĩnh viễn ngay sau
   * mount: LED không bao giờ hiện, `vuaRen` không bao giờ đặt, và test (không StrictMode)
   * vẫn xanh. Bắt được khi soi trình duyệt thật (D295). Bài test nay bọc `<StrictMode>`.
   */
  const song = useRef(true);
  useEffect(() => { song.current = true; return () => { song.current = false; }; }, []);

  const chay = useCallback(async <T,>(viec: () => Promise<T>): Promise<T> => {
    let huy = false;
    const dat = (n: number | null): void => { if (song.current && !huy) datSang(n); };
    dat(0);
    const buoc = ms / SO_O_LED;
    let lit = 0;
    const led = new Promise<void>((ok) => {
      const tick = (): void => {
        if (huy) return;
        lit += 1;
        dat(Math.min(lit, SO_O_LED));
        if (lit < SO_O_LED) setTimeout(tick, buoc); else ok();
      };
      setTimeout(tick, buoc);
    });
    try {
      const [kq] = await Promise.all([viec(), led]);
      return kq;
    } finally {
      huy = true;
      if (song.current) datSang(null);
    }
  }, [ms]);

  return { sang, chay };
}

function Led({ sang, nhan }: { sang: number | null; nhan: string }): React.ReactElement | null {
  if (sang === null) return null;
  return (
    <>
      <div className={`${s.led} ${s.khac}`} data-testid="led" data-sang={sang}>
        {Array.from({ length: SO_O_LED }, (_, i) => (
          <i key={i} className={i < sang ? s.on : undefined} />
        ))}
      </div>
      <p className={s.ledNhan}>{nhan}</p>
    </>
  );
}

/* ═══ gốc ═══════════════════════════════════════════════════════════════════ */

/**
 * ⚠ Xuất ra cho bài test; màn CÀI ĐẶT bọc nó trong `<KhoProvider>` (kho thật), test bơm
 * `KhoTrongBoNho`. `nhip` chỉ để test rút ngắn LED/giữ — mặc định là số của demo.
 *
 * ⚠⚠ `suaPhongVan` LÀ MỘT CALLBACK, KHÔNG PHẢI `useNavigate()` Ở TRONG ĐÂY (D308).
 * Khối này được dựng NGOÀI router ở `pfm_cai_dat.test.tsx` (22 bài), nên một hook
 * đòi router sẽ ném cả loạt — đúng cú `useMatches` trong `ScreenFrame` vừa phải gỡ
 * ở D306. Người gọi (`BoardCaiDatPfm`, `screens/CaiDat`) đứng trong router thì
 * người gọi lo việc đi; vắng callback thì hàng ấy không hiện.
 * ⚠ `moChanDung` (D355/D356) đi ĐÚNG khuôn `moLoTrinh` — cùng lý do, cùng cách vắng mặt.
 */
export function CaiDatPfm(
  { nhip, suaPhongVan, moLoTrinh, moChanDung }: {
    nhip?: NhipCaiDat; suaPhongVan?: (() => void) | undefined; moLoTrinh?: (() => void) | undefined;
    moChanDung?: (() => void) | undefined;
  } = {},
): React.ReactElement {
  const ledMs = nhip?.ledMs ?? LED_MS;
  const giuMs = nhip?.giuMs ?? GIU_XOA_MS;

  /*
   * ⚠ CẢ MÀN khai "đang thao tác", không chỉ lúc giữ nút xoá: mascot Oracle là một nút
   * `position: fixed` 44×44 ở mép phải-dưới, đúng chỗ CỘT công tắc và nút `?` của màn này
   * xếp thành hàng dọc — đo được: chạm mép phải một công tắc dừng trong dải ấy mở chat
   * thay vì gạt. Founder 06/09: *"những lúc cần thao tác cho nó mất hẳn cũng được"*, và cả
   * màn Cài đặt là một chuỗi thao tác. `useDangThaoTac` ĐẾM CHỒNG nên cú giữ-để-xoá của
   * khối ⑤ vẫn khai thêm một lượt của nó — không đè nhau.
   */
  useDangThaoTac(true);

  const me = useMe();
  const user = me.data?.user ?? null;
  /* Khách (0030) bị `chanKhach` ở mọi đường `/pfm/*` — không mời bấm một nút chắc chắn 403. */
  const coNguoi = user !== null && user.la_khach !== true;
  const userId = user?.user_id ?? '';
  const cua = useCuaPfm();
  const cuaHien = useMemo(() => cua ?? bonTat(), [cua]);
  const kho = useKho();

  /* Chìa đã rèn chưa — đọc KHO, `instanceof` (một `{}` từ bản lỗi cũ không phải chìa). */
  const chia = useQuery({
    queryKey: KHOA_CHIA,
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => (await docChia(kho!)) instanceof CryptoKey,
  });
  const coChia = chia.data === true;

  /* Xoá sạch xong ⇒ ②③④ về trạng thái ban đầu (demo `giuXongHam`) — remount bằng khoá. */
  const [theHe, datTheHe] = useState(0);

  return (
    <div className={s.man} data-testid="cai-dat-pfm">
      <div className={s.dauTrang}>
        <p className={s.nhanTrang}>{CHU_CAI_DAT.tieuKhoi}</p>
        <p className={s.phuTrang}>{CHU_CAI_DAT.phuKhoi}</p>
      </div>
      {!coNguoi && <p className={s.chuThich}>{CHU_CAI_DAT.dangNhapDe}</p>}
      {coNguoi && kho === null && <p className={s.chuThich}>{CHU_CAI_DAT.khoChuaMo}</p>}

      <KhoiCua cua={cuaHien} coNguoi={coNguoi} />
      <KhoiMa
        key={`ma-${theHe}`} kho={kho} userId={userId} ketBat={cuaHien.ket} coChia={coChia}
        ledMs={ledMs}
      />
      <KhoiSaoLuu key={`luu-${theHe}`} kho={kho} ketBat={cuaHien.ket} coChia={coChia} ledMs={ledMs} />
      <KhoiKhoiPhuc key={`kp-${theHe}`} kho={kho} userId={userId} ketBat={cuaHien.ket} ledMs={ledMs} />
      <KhoiXoa kho={kho} coNguoi={coNguoi} giuMs={giuMs} onXong={() => datTheHe((t) => t + 1)} />
      <KhoiKhac kho={kho} suaPhongVan={suaPhongVan} moLoTrinh={moLoTrinh} moChanDung={moChanDung} />
    </div>
  );
}

/* ═══ ① BỐN CỬA + CÔNG TẮC CHUNG ════════════════════════════════════════════ */

function KhoiCua(
  { cua, coNguoi }: { cua: Record<CuaPfm, boolean>; coNguoi: boolean },
): React.ReactElement {
  const doi = useDoiCua();
  const [moChiTiet, datMoChiTiet] = useState<CuaPfm | null>(null);
  /*
   * Giờ bật CHỈ biết trong phiên này (server không trả mốc từng cửa; `pfm_bat_dau` là mốc
   * cửa ĐẦU TIÊN). Thiếu ⇒ vắng, không bịa (P7): tải lại trang thì vết chỉ còn "đã bật · v1".
   */
  const [gioBat, datGioBat] = useState<Partial<Record<CuaPfm, string>>>({});
  const [loi, datLoi] = useState<string | null>(null);
  const [dangChung, datDangChung] = useState(false);
  const tatCa = CUA_PFM.every((c) => cua[c]);
  const banRon = doi.isPending || dangChung;

  /** Không đổi thì KHÔNG gọi — server cũng chỉ trả `doi:false`, nhưng đó vẫn là một request. */
  async function datCua(c: CuaPfm, bat: boolean, gio: string): Promise<void> {
    if (cua[c] === bat) return;
    await doi.mutateAsync({ cua: c, bat });
    if (bat) datGioBat((g) => ({ ...g, [c]: gio }));
  }

  function loiCua(c: CuaPfm): string {
    return `${CHU_CAI_DAT.loiCuaPre}${VAN_BAN_CONSENT[vanBanCua(c)].tieuDe}${CHU_CAI_DAT.loiCuaHau}`;
  }

  async function bamMot(c: CuaPfm): Promise<void> {
    rung(8);
    datLoi(null);
    try { await datCua(c, !cua[c], gioHienThi(bayGio())); } catch { datLoi(loiCua(c)); }
  }

  /** Bốn cửa TUẦN TỰ theo `CUA_PFM`, CÙNG một mốc giờ; dừng ở lỗi đầu tiên và nói ra. */
  async function bamChung(): Promise<void> {
    rung(10);
    datLoi(null);
    datDangChung(true);
    const dich = !tatCa;
    const gio = gioHienThi(bayGio());
    try {
      for (const c of CUA_PFM) {
        try { await datCua(c, dich, gio); } catch { datLoi(loiCua(c)); break; }
      }
    } finally {
      datDangChung(false);
    }
  }

  return (
    <div className={`${s.khoi2} ${s.khac}`} data-testid="khoi-cua">
      <div className={s.hang2}>
        <span className={s.ten2}>
          <span className={`${s.soKhoi} ${s.khac}`}>①</span>{CHU_CONSENT_KHOI.tieuKhoi}
        </span>
      </div>

      <div className={s.hangCt}>
        <span className={s.than}>
          <span className={s.ten2} id="pfm_nhan_chung">
            {tatCa ? CHU_CONSENT_KHOI.congTacChungTat : CHU_CONSENT_KHOI.congTacChung}
          </span>
          <span className={s.mo}>{CHU_CONSENT_KHOI.chuThichChung}</span>
        </span>
        <button
          type="button" className={s.cham44} role="switch" aria-checked={tatCa}
          aria-labelledby="pfm_nhan_chung" disabled={!coNguoi || banRon}
          onClick={() => void bamChung()} data-testid="ct-chung"
        >
          <span className={`${s.congTac} ${s.khac}`}><span className={`${s.nut} ${s.khac}`} /></span>
        </button>
      </div>

      {CUA_PFM.map((c) => {
        const vb = VAN_BAN_CONSENT[vanBanCua(c)];
        const on = cua[c];
        const mo = moChiTiet === c;
        const gio = gioBat[c];
        const vet = `${CHU_CONSENT_KHOI.vetDaBat} · ${CONSENT_PHIEN_BAN[vanBanCua(c)]}`
          + (gio ? ` · ${gio}` : '');
        return (
          <div key={c} className={`${s.cua} ${s.khac} ${on ? s.bat : ''}`} data-testid={`cua-${c}`}>
            <div className={s.cuaDau}>
              <span className={s.than}>
                <span className={s.cuaTen} id={`pfm_ten_${c}`}>{vb.tieuDe}</span>
                <span className={s.cuaTom}>{vb.tomTat}</span>
              </span>
              {/* `?` mở hai dòng còn lại; mở hàng này tự đóng hàng kia (nếp "gấp theo khối"). */}
              <button
                type="button" className={s.cham44} aria-expanded={mo}
                aria-controls={`pfm_chitiet_${c}`}
                aria-label={mo ? CHU_CONSENT_KHOI.dongChiTiet : CHU_CONSENT_KHOI.chiTiet}
                onClick={() => { rung(6); datMoChiTiet(mo ? null : c); }}
                data-testid={`chitiet-${c}`}
              >
                <span className={`${s.hoi} ${s.khac}`}>{mo ? CHU_CAI_DAT.nutChiTietDong : '?'}</span>
              </button>
              <button
                type="button" className={s.cham44} role="switch" aria-checked={on}
                aria-labelledby={`pfm_ten_${c}`} disabled={!coNguoi || banRon}
                onClick={() => void bamMot(c)} data-testid={`ct-${c}`}
              >
                <span className={`${s.congTac} ${s.khac}`}><span className={`${s.nut} ${s.khac}`} /></span>
              </button>
            </div>
            {/* Dòng RỜI MÁY LUÔN HIỆN — xem chú thích `VanBanConsent.roiMay`. */}
            <p className={s.cuaDong} data-testid={`roimay-${c}`}>
              <b>{CHU_CONSENT_KHOI.nhanRoiMay}:</b> {vb.roiMay}
            </p>
            {mo && (
              <div id={`pfm_chitiet_${c}`}>
                <p className={s.cuaDong}><b>{CHU_CONSENT_KHOI.nhanKhongDoc}:</b> {vb.mayChuKhongDoc}</p>
                <p className={s.cuaDong}>{vb.chot}</p>
              </div>
            )}
            <p className={s.cuaVet} data-testid={`vet-${c}`}>{on ? vet : CHU_CONSENT_KHOI.daTat}</p>
          </div>
        );
      })}
      {loi && <p className={s.loiCua} role="alert">{loi}</p>}
    </div>
  );
}

/* ═══ ② MÃ KHÔI PHỤC ════════════════════════════════════════════════════════ */

function KhoiMa({ kho, userId, ketBat, coChia, ledMs }: {
  kho: KhoPfm | null; userId: string; ketBat: boolean; coChia: boolean; ledMs: number;
}): React.ReactElement {
  /* Mã sinh MỘT lần lúc dựng khối (demo `maHienTai = taoMa()`); xoá sạch remount ⇒ mã mới. */
  const [ma] = useState(() => taoMaKhoiPhuc());
  const [daTick, datDaTick] = useState(false);
  const [toast, datToast] = useState<string | null>(null);
  const [vuaRen, datVuaRen] = useState(false);
  const [giaiMo, datGiaiMo] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const led = useLed(ledMs);
  const ghiKho = useGhiKho();
  const song = useRef(true);
  useEffect(() => { song.current = true; return () => { song.current = false; }; }, []);

  /*
   * XONG bấm được khi: đã tích · CHƯA có chìa · có kho · biết user · LED không chạy.
   * ⚠ "Chưa có chìa": rèn chìa mới đè lên chìa cũ là làm mọi lát tháng ĐÃ ĐÓNG (K10 không
   * ghi lại) không mở được nữa. Demo cũng khoá XONG sau khi rèn (tới lúc xoá sạch).
   */
  const xongDuoc = daTick && !coChia && kho !== null && userId !== '' && led.sang === null;
  /* Đã có chìa từ trước (tải lại trang) ⇒ không bày một mã mới không dùng được. */
  const maHien = coChia && !vuaRen ? CHU_CAI_DAT.maTrong : mocMa(ma);

  async function chep(): Promise<void> {
    const chu = mocMa(ma);
    try {
      const cb = navigator.clipboard;
      if (!cb || typeof cb.writeText !== 'function') throw new Error('khong_co_clipboard');
      await cb.writeText(chu);
      datToast(CHU_CAI_DAT.daChep);
    } catch {
      datToast(CHU_CAI_DAT.chuaChep);
    }
    setTimeout(() => { if (song.current) datToast(null); }, TOAST_MS);
  }

  async function xong(): Promise<void> {
    if (!xongDuoc) return;
    rung(10);
    datLoi(null);
    try {
      /* `ghiKho(['meta'])` làm tươi truy vấn chìa ⇒ khối ③ mở khoá theo đúng kho. */
      await led.chay(() => ghiKho(['meta'], (k) => taoVaLuuChia(k, userId, bayGio(), () => ma)));
      if (song.current) datVuaRen(true);
    } catch {
      if (song.current) datLoi(CHU_VUONG.loi_may);
    }
  }

  return (
    <div className={`${s.khoi2} ${s.khac} ${ketBat ? '' : s.khoa}`} data-testid="khoi-ma">
      <div className={s.hang2}>
        <span className={s.ten2}><span className={`${s.soKhoi} ${s.khac}`}>②</span>{CHU_CAI_DAT.tieuMa}</span>
        <button
          type="button" className={`${s.hoi} ${s.khac}`} aria-expanded={giaiMo}
          onClick={() => datGiaiMo(!giaiMo)}
        >
          {giaiMo ? CHU_CAI_DAT.nutChiTietDong : '?'}
        </button>
      </div>
      <p className={s.khoaNhan}>{CHU_CAI_DAT.khoaTheoKet}</p>
      {giaiMo && <p className={s.giai}>{CHU_CAI_DAT.giaiMa}</p>}

      <div className={s.than2}>
        <p className={s.maChu} data-testid="ma-hien">{maHien}</p>
        <div className={s.hangMa}>
          <button type="button" className={`${s.nut2} ${s.khac} ${s.rong100}`} onClick={() => void chep()}>
            {CHU_CAI_DAT.nutChep}
          </button>
        </div>
        {toast && <p className={`${s.toastNho} ${s.khac}`}>{toast}</p>}

        <label className={s.oTick}>
          <input
            type="checkbox" checked={daTick} onChange={(e) => datDaTick(e.target.checked)}
            data-testid="tick-ma"
          />
          {CHU_CAI_DAT.tickMa}
        </label>

        <p className={`${s.canhMa} ${s.khac}`}>{CHU_CAI_DAT.canhMa}</p>

        <div className={s.hangMa}>
          <button
            type="button" className={`${s.nut2} ${s.khac} ${s.chinh} ${s.rong100}`}
            disabled={!xongDuoc} onClick={() => void xong()} data-testid="bt-xong-ma"
          >
            {CHU_CAI_DAT.nutXong}
          </button>
        </div>

        <Led sang={led.sang} nhan={CHU_CAI_DAT.dangRen} />
        {(vuaRen || (coChia && led.sang === null)) && (
          <p className={s.chuThich} data-testid="chia-xong">{CHU_CAI_DAT.chiaXong}</p>
        )}
        {loi && <p className={s.loiCua} role="alert">{loi}</p>}
      </div>
    </div>
  );
}

/* ═══ ③ SAO LƯU NGAY ════════════════════════════════════════════════════════ */

function KhoiSaoLuu({ kho, ketBat, coChia, ledMs }: {
  kho: KhoPfm | null; ketBat: boolean; coChia: boolean; ledMs: number;
}): React.ReactElement {
  const [trangThai, datTrangThai] = useState(CHU_CAI_DAT.chuaLuu);
  const led = useLed(ledMs);
  const qc = useQueryClient();
  const song = useRef(true);
  useEffect(() => { song.current = true; return () => { song.current = false; }; }, []);
  /* Khoá HAI nấc: cửa két bật chưa đủ, còn phải có chìa (khối ② hoặc ④) — `docChia` phải
     trả một CryptoKey thật trước khi gửi được lát nào (`ket_chay.ts` §`chayLuot`). */
  const mo = ketBat && coChia;

  async function saoLuu(): Promise<void> {
    if (!mo || kho === null || led.sang !== null) return;
    rung(10);
    const kq = await led.chay(() => saoLuuMotLuot(kho, homNay(), bayGio(), thangNay()));
    if (!song.current) return;
    datTrangThai(kq.vuong
      ? CHU_VUONG[kq.vuong]
      : `${CHU_CAI_DAT.vuaXongPre}${kq.daLuu.length}${CHU_CAI_DAT.vuaXongHau}`);
    // Driver ghi sổ két vào `meta` — làm tươi tiền tố ấy cho ai đang đọc nó.
    void qc.invalidateQueries({ queryKey: KHOA_PFM.ngan('meta') });
  }

  return (
    <div className={`${s.khoi2} ${s.khac} ${mo ? '' : s.khoa}`} data-testid="khoi-sao-luu">
      <span className={s.ten2}><span className={`${s.soKhoi} ${s.khac}`}>③</span>{CHU_CAI_DAT.tieuSaoLuu}</span>
      <p className={s.khoaNhan}>{ketBat ? CHU_CAI_DAT.khoaTheoChia : CHU_CAI_DAT.khoaTheoKet}</p>

      <div className={s.than2}>
        <p className={s.chuThich} data-testid="trang-thai-luu">{trangThai}</p>
        <div className={s.hangMa}>
          <button
            type="button" className={`${s.nut2} ${s.khac} ${s.chinh} ${s.rong100}`}
            disabled={!mo || kho === null || led.sang !== null}
            onClick={() => void saoLuu()} data-testid="bt-sao-luu"
          >
            {CHU_CAI_DAT.nutSaoLuu}
          </button>
        </div>
        <Led sang={led.sang} nhan={CHU_CAI_DAT.dangLuu} />
      </div>
    </div>
  );
}

/* ═══ ④ KHÔI PHỤC ═══════════════════════════════════════════════════════════ */

function KhoiKhoiPhuc({ kho, userId, ketBat, ledMs }: {
  kho: KhoPfm | null; userId: string; ketBat: boolean; ledMs: number;
}): React.ReactElement {
  const [raw, datRaw] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [kq, datKq] = useState<KetQuaKhoiPhuc | null>(null);
  const [giaiMo, datGiaiMo] = useState(false);
  const led = useLed(ledMs);
  const qc = useQueryClient();
  const song = useRef(true);
  useEffect(() => { song.current = true; return () => { song.current = false; }; }, []);

  /** Lỗi ĐỌC ĐƯỢC cho một mã không hợp lệ — cùng phép chuẩn hoá của `chuanMa`, không lộ thông điệp của nó. */
  function loiMa(): string {
    const t = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (t.length !== DAI_MA) {
      return `${CHU_CAI_DAT.loiDoDaiPre}${DAI_MA}${CHU_CAI_DAT.loiDoDaiGiua}${t.length}${CHU_CAI_DAT.loiDoDaiHau}`;
    }
    return CHU_CAI_DAT.loiKyTuLa;
  }

  async function khoiPhuc(): Promise<void> {
    if (!ketBat || kho === null || userId === '' || led.sang !== null) return;
    let maChuan: string;
    try { maChuan = chuanMa(raw); } catch { datLoi(loiMa()); return; }
    datLoi(null);
    rung(10);
    try {
      const ra = await led.chay(async () => {
        /*
         * ⚠ RÈN CHÌA MÀ CHƯA CẤT. `khoiPhucChia` (ket_may) cất ngay — nhưng một mã gõ SAI sẽ
         * đè lên chìa đang có: két cũ không mở được nữa, mà không có gì báo. Nên cất CHỈ
         * KHI mã này không bị từ chối bởi mọi lát trên máy chủ (`khong_mo_duoc`). Không có
         * lát nào để thử (máy chủ trống) thì cất — mã là do người dùng chọn.
         */
        const khoa = await suyKhoa(maChuan, await muoiCuaUser(userId));
        const luc = bayGio();
        const r = await khoiPhucTuKet(kho, khoa, latDeKhoiPhuc(thangNay()), luc);
        if (r.vuong !== 'khong_mo_duoc') await catChia(kho, khoa, luc);
        return r;
      });
      if (!song.current) return;
      datKq(ra);
      // Trộn xong thì mọi ngăn có thể đã đổi — mọi màn PFM đọc lại từ kho.
      await qc.invalidateQueries({ queryKey: ['pfm'] });
    } catch {
      if (song.current) datLoi(CHU_VUONG.loi_may);
    }
  }

  return (
    <div className={`${s.khoi2} ${s.khac} ${ketBat ? '' : s.khoa}`} data-testid="khoi-khoi-phuc">
      <span className={s.ten2}><span className={`${s.soKhoi} ${s.khac}`}>④</span>{CHU_CAI_DAT.tieuKhoiPhuc}</span>
      <p className={s.khoaNhan}>{CHU_CAI_DAT.khoaTheoKet}</p>

      <div className={s.than2}>
        <input
          className={`${s.oNhap} ${s.khac} ${loi ? s.loi : ''}`} type="text"
          placeholder={CHU_CAI_DAT.oMaGiuCho} autoComplete="off" spellCheck={false}
          value={raw} onChange={(e) => datRaw(e.target.value)} data-testid="o-ma-kp"
        />
        {loi && <p className={s.chuThich} role="alert">{loi}</p>}
        <div className={s.hangMa} style={{ marginTop: 8 }}>
          <button
            type="button" className={`${s.nut2} ${s.khac} ${s.chinh} ${s.rong100}`}
            disabled={!ketBat || kho === null || led.sang !== null}
            onClick={() => void khoiPhuc()} data-testid="bt-khoi-phuc"
          >
            {CHU_CAI_DAT.nutKhoiPhuc}
          </button>
        </div>
        <Led sang={led.sang} nhan={CHU_CAI_DAT.dangKhoiPhuc} />

        {kq && (
          <>
            <div className={`${s.hoaDon} ${s.khac}`} data-testid="hoa-don">
              <div className={`${s.o} ${s.khac}`}><b data-testid="hd-them">{kq.them}</b><span>{CHU_CAI_DAT.hdThem}</span></div>
              <div className={`${s.o} ${s.khac}`}><b data-testid="hd-giu">{kq.giu}</b><span>{CHU_CAI_DAT.hdGiu}</span></div>
              <div className={`${s.o} ${s.khac}`}><b data-testid="hd-can">{kq.can.length}</b><span>{CHU_CAI_DAT.hdCan}</span></div>
            </div>
            <div className={s.hangHoi}>
              <p>{CHU_CAI_DAT.hoiHoaDon}</p>
              <button
                type="button" className={`${s.hoi} ${s.khac}`} aria-expanded={giaiMo}
                onClick={() => datGiaiMo(!giaiMo)}
              >
                {giaiMo ? CHU_CAI_DAT.nutChiTietDong : '?'}
              </button>
            </div>
            {giaiMo && <p className={s.giai}>{CHU_CAI_DAT.giaiHoaDon}</p>}
            {/* Khôi phục KHUYẾT không được phép trông như đầy đủ (`KetQuaKhoiPhuc.hong`). */}
            {kq.hong > 0 && (
              <p className={s.chuThich}>{CHU_CAI_DAT.hongPre}{kq.hong}{CHU_CAI_DAT.hongHau}</p>
            )}
            {kq.vuong && <p className={s.chuThich} role="alert">{CHU_VUONG[kq.vuong]}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══ ⑤ XOÁ SẠCH — GIỮ 2 GIÂY ═══════════════════════════════════════════════ */

function KhoiXoa({ kho, coNguoi, giuMs, onXong }: {
  kho: KhoPfm | null; coNguoi: boolean; giuMs: number; onXong: () => void;
}): React.ReactElement {
  const [dangGiu, datDangGiu] = useState(false);
  const [tienDo, datTienDo] = useState(0);
  const [dangXoa, datDangXoa] = useState(false);
  const [daXoa, datDaXoa] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  /* Oracle nhường chỗ trong lúc tay đang giữ (D287). */
  useDangThaoTac(dangGiu);
  const xoaKho = useXoaSachKho();
  const qc = useQueryClient();
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buoc = useRef(0);
  const song = useRef(true);
  useEffect(() => {
    song.current = true;
    return () => { song.current = false; if (hen.current) clearTimeout(hen.current); };
  }, []);
  const tongBuoc = Math.max(1, Math.round(giuMs / GIU_BUOC_MS));

  function huy(): void {
    if (hen.current) clearTimeout(hen.current);
    hen.current = null;
    buoc.current = 0;
    datTienDo(0);
    datDangGiu(false);
  }

  /*
   * `setTimeout` đếm BƯỚC, không đọc đồng hồ: rAF ngừng bắn hẳn khi pane bị ẩn (demo
   * D294), còn `setTimeout` chỉ giãn nhịp — một nút giữ-để-xoá mà không tự chấm dứt là
   * một nút hỏng theo môi trường hiển thị, và đó không phải rủi ro nên nhận cho một hành
   * động không hoàn tác được (P9 🔒).
   */
  function tick(): void {
    buoc.current += 1;
    datTienDo(Math.min(1, buoc.current / tongBuoc));
    if (buoc.current >= tongBuoc) { hen.current = null; void xongGiu(); return; }
    hen.current = setTimeout(tick, GIU_BUOC_MS);
  }

  function batDau(e: PointerEventReact<HTMLButtonElement>): void {
    if (dangXoa || daXoa || kho === null || !coNguoi || hen.current !== null) return;
    buoc.current = 0;
    datDangGiu(true);
    hen.current = setTimeout(tick, GIU_BUOC_MS);
    /* Bắt giữ giờ TRƯỚC; chụp con trỏ chỉ là tiện ích, nó ném với vài kiểu con trỏ (demo). */
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* không chặn */ }
  }

  function nha(): void {
    if (hen.current !== null) huy();
  }

  async function xongGiu(): Promise<void> {
    huy();
    rung(24);
    datDangXoa(true);
    datLoi(null);
    try {
      /*
       * MÁY CHỦ TRƯỚC, MÁY NÀY SAU. Ngược lại thì một cú mất mạng để lại: máy sạch, máy
       * chủ còn nguyên — và người dùng tin là đã sạch (P9 🔒). Máy chủ hỏng ⇒ không xoá gì,
       * nói ra, cho bấm lại.
       */
      await xoaSachPfm();
      await xoaKho();
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      if (!song.current) return;
      datDaXoa(true);
      onXong();
      setTimeout(() => { if (song.current) datDaXoa(false); }, DAU_XOA_MS);
    } catch {
      if (song.current) datLoi(CHU_CAI_DAT.loiXoa);
    } finally {
      if (song.current) datDangXoa(false);
    }
  }

  return (
    <div className={`${s.khoi2} ${s.khac}`} data-testid="khoi-xoa">
      <span className={s.ten2}><span className={`${s.soKhoi} ${s.khac}`}>⑤</span>{CHU_CAI_DAT.tieuXoa}</span>
      <div className={s.than2}>
        <p className={s.chuThich}>{CHU_CAI_DAT.giaiXoa}</p>
        <button
          type="button" className={`${s.btGiu} ${s.khac}`}
          disabled={!coNguoi || kho === null || dangXoa}
          onPointerDown={batDau} onPointerUp={nha} onPointerLeave={nha} onPointerCancel={nha}
          data-testid="bt-xoa" data-tien-do={tienDo.toFixed(2)}
        >
          <span className={s.giuDay} aria-hidden="true" style={{ ['--giu' as string]: tienDo }} />
          <span>
            {daXoa
              ? CHU_CAI_DAT.daXoa
              : `${CHU_CAI_DAT.giuDeXoaPre}${Math.round(giuMs / 1000)}${CHU_CAI_DAT.giuDeXoaHau}`}
          </span>
        </button>
        {daXoa && (
          <>
            <p className={`${s.dauXoa} ${s.khac}`} data-testid="dau-xoa">{CHU_CAI_DAT.dauXoa}</p>
            <p className={s.chuThich}>{CHU_CAI_DAT.ketQuaXoa}</p>
          </>
        )}
        {loi && <p className={s.loiXoa} role="alert">{loi}</p>}
      </div>
    </div>
  );
}

/* ═══ ⑥ TẮT GƯƠNG / TẮT NHẮC — cục bộ, không phụ thuộc cửa nào ═══════════════ */

function KhoiKhac(
  { kho, suaPhongVan, moLoTrinh, moChanDung }: {
    kho: KhoPfm | null; suaPhongVan?: (() => void) | undefined; moLoTrinh?: (() => void) | undefined;
    moChanDung?: (() => void) | undefined;
  },
): React.ReactElement {
  const q = useQuery({
    queryKey: KHOA_CAI_DAT_MAY,
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () =>
      (await kho!.doc<CaiDatMay>('meta', ID_CAI_DAT_MAY))?.d ?? CAI_DAT_MAY_MAC_DINH,
  });
  const cd = q.data ?? CAI_DAT_MAY_MAC_DINH;
  const ghiKho = useGhiKho();

  async function doi(k: keyof CaiDatMay): Promise<void> {
    rung(6);
    const moi: CaiDatMay = { ...cd, [k]: !cd[k] };
    await ghiKho(['meta'], (kh) =>
      kh.ghi('meta', { id: ID_CAI_DAT_MAY, thang: thangNay(), suaLuc: bayGio(), d: moi }));
  }

  const hang = (k: keyof CaiDatMay, ten: string, mo: string, testId: string): React.ReactElement => (
    <div className={s.hangCt}>
      <span className={s.than}>
        <span className={s.ten2}>{ten}</span>
        <span className={s.mo}>{mo}</span>
      </span>
      <button
        type="button" className={`${s.congTac} ${s.khac}`} role="switch" aria-checked={cd[k]}
        aria-label={ten} disabled={kho === null} onClick={() => void doi(k)} data-testid={testId}
      >
        <span className={`${s.nut} ${s.khac}`} />
      </button>
    </div>
  );

  return (
    <div className={`${s.khoi2} ${s.khac}`} data-testid="khoi-khac">
      <p className={`${s.tieu} ${s.tieuKhac}`}>{CHU_CAI_DAT.tieuKhac}</p>
      {hang('guongTat', CHU_CAI_DAT.tatGuong, CHU_CAI_DAT.moTatGuong, 'ct-guong')}
      {hang('nhacTat', CHU_CAI_DAT.tatNhac, CHU_CAI_DAT.moTatNhac, 'ct-nhac')}
      {suaPhongVan !== undefined && (
        <div className={s.hangCt}>
          <span className={s.than}>
            <span className={s.ten2}>{CHU_CAI_DAT.suaPv}</span>
            <span className={s.mo}>{CHU_CAI_DAT.moSuaPv}</span>
          </span>
          <button
            type="button" className={`${s.nut2} ${s.nutHang} ${s.khac}`}
            onClick={suaPhongVan} data-testid="nut-sua-pv"
          >
            {CHU_CAI_DAT.nutSuaPv}
          </button>
        </div>
      )}
      {/*
        D325 — LỐI VÀO LẠI LỘ TRÌNH. Trước D325 màn lộ trình chỉ tới được ĐÚNG MỘT LẦN (ngay sau
        phỏng vấn đầu): ngoài bảng route, `ROUTE_TAI_CHINH_LO_TRINH` chỉ có một người gọi là
        PhongVan. Cùng khuôn callback với SỬA SÁU CÂU: người gọi lo việc đi, vắng thì hàng ẩn.
      */}
      {moLoTrinh !== undefined && (
        <div className={s.hangCt}>
          <span className={s.than}>
            <span className={s.ten2}>{CHU_CAI_DAT.moLt}</span>
            <span className={s.mo}>{CHU_CAI_DAT.moTaMoLt}</span>
          </span>
          <button
            type="button" className={`${s.nut2} ${s.nutHang} ${s.khac}`}
            onClick={moLoTrinh} data-testid="nut-mo-lt"
          >
            {CHU_CAI_DAT.nutMoLt}
          </button>
        </div>
      )}
      {/*
        D355/D356 — LỐI VÀO LẠI NGÀY ĐẦU, đúng khuôn hàng "Xem lại lộ trình" ngay trên
        (D325). Cùng lý do callback: người gọi đứng trong router lo việc đi, vắng thì hàng ẩn.
      */}
      {moChanDung !== undefined && (
        <div className={s.hangCt}>
          <span className={s.than}>
            <span className={s.ten2}>{CHU_CAI_DAT.moCd}</span>
            <span className={s.mo}>{CHU_CAI_DAT.moTaMoCd}</span>
          </span>
          <button
            type="button" className={`${s.nut2} ${s.nutHang} ${s.khac}`}
            onClick={moChanDung} data-testid="nut-mo-cd"
          >
            {CHU_CAI_DAT.nutMoCd}
          </button>
        </div>
      )}
    </div>
  );
}
