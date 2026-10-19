/**
 * PFM — KHAY PHÂN BỔ ở màn HŨ (D410 → D420 → D421 → D424, founder 26/09).
 *
 * D410: *"Ở trên là các hũ, bấm vào 1 hũ thì sẽ hiện ra số tiền … có số lượng trên mỗi tờ tiền, bấm vào để phân vào hũ
 * được chọn"* + hiệu ứng **"Hấp thụ năng lượng"** (tờ co thành hạt sáng, bay vút vào thanh đo, thanh loé ở mốc mới, số
 * chạy lên). D420: khay bày TIỀN CÒN LẠI bẻ ra tờ theo mệnh giá, mỗi cú chạm MỘT tờ · GÕ SỐ · QUY TẮC TỰ CHIA.
 * D421 — không gì tự biến mất (kệ · khay · thẻ quy tắc) · HAI LOẠI HŨ (`pfm/nhom_hu.ts`) · RÚT RA về ví.
 * D424 — founder: *"Sao phiếu chi ko làm tính năng nhập tích lũy giống thu?"*, câu đóng chốt "tờ + GÕ SỐ như thu": phía
 *   CHI của khay đi ĐÚNG khuôn phía THU. Hũ tích lũy: tờ của TIỀN CÒN LẠI (NẠP VÀO) · tờ của hũ (RÚT RA). Hũ tiêu dùng:
 *   tờ của TIỀN CHI CHƯA CHIA tháng này (CHIA VÀO) · tờ của phần hũ đã tiêu (GỠ RA). Cả hai có GÕ SỐ. Hũ tiêu dùng đếm
 *   TỔNG đã gán, không nhớ phiếu nào (`so.ts` §`laGanChi`).
 *
 * Hai mảnh, MỘT trạng thái (`usePhanBo`, dựng ở `RuotHu`): KỆ HŨ ở đầu màn (`KeHuPhanBo` — thẻ quy tắc + hai nhóm hũ) ·
 * KHAY trong thanh neo đáy (`KhayPhanBo`) — khay phải nằm CUỐI nội dung thì `sticky` mới giữ được nó ở góc dưới.
 *
 * ⚠ Dữ liệu: `pfm/phan_bo.ts` (ví · tiền chi chưa chia · tờ). Ghi qua `napKhoanKho` / `ganKhoanKho` / `chayTuDongKho`
 *   (đọc TRONG KHO, xếp hàng) — không cú chạm nào nạp quá ví, rút quá hũ, chia quá phần chi chưa chia, không lượt mở màn
 *   nào chia hai lần.
 * ⚠⚠ HIỆU ỨNG KHÔNG PHẢI NGUỒN SỰ THẬT: cú ghi đi ngay lúc chạm; hạt bay, cú loé, số chạy chỉ là lớp vẽ đè lên. Mọi
 *   mốc hẹn bằng đồng hồ theo `NHIP` (không chờ `onfinish`, không chờ rAF — khung ẩn thì cả hai có thể không tới); số
 *   chạy có hẹn CHỐT để con số cuối luôn hiện. Giảm chuyển động ⇒ không bay, không chạy số: số mới hiện ngay.
 * ⚠ Chỉ animate `transform`/`opacity` (luật ba runtime). Màu tờ lấy đúng bậc của `TO_TIEN` (bàn tiền) qua biến inline.
 * ⚠ A10 🔒 — không câu nào gợi nạp hũ nào, bao nhiêu, hay tiêu ít đi; khay chỉ bày, đếm và hỏi.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { ThanhTienDo } from '@/components/pfm/ThanhTienDo';
import { BanPhim, HOAN_TAC_MS, TO_TIEN, itChuyenDong } from '@/components/pfm/BanTien';
import { useGhiKho } from '@/pfm/dung_kho';
import { daTieuTrongThang, tongGopVaoHu, type Khoan } from '@/pfm/so';
import { laTichLuy, laTieuDung, tienDo, type Hu, type QuyTacTuDong } from '@/pfm/hu';
import { chiChuaChia, chiaTo, taoKhoanPhanBo, tienConLai, type ChongTo } from '@/pfm/phan_bo';
import { phanTiLe, type CachChay, type DenHan } from '@/pfm/tu_dong';
import { chayTuDongKho, ganKhoanKho, napKhoanKho } from '@/pfm/sua_ban_ghi';
import { bayGio, sinhId, thangNay } from '@/pfm/thoi_gian';
import { NHIP } from '@/lib/nhip';
import { useDangThaoTac } from '@/lib/thao_tac';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { CHU_MAN_SO, CHU_PHAN_BO as CP } from '@/lib/pfm_chu';
import s from './PhanBo.module.css';

const dinhDang = (n: number): string => n.toLocaleString('vi-VN');

/** Mệnh giá của khay = mệnh giá của bàn tiền (một nguồn: `TO_TIEN`). */
const MENH_GIA: readonly number[] = TO_TIEN.map((t) => t.gt);
const TO_NHO_NHAT = Math.min(...MENH_GIA);

/** Nhãn gọn trên tờ: 45.000 ⇒ "45k" · 1.250.000 ⇒ "1,25tr". Số lẻ nghìn giữ nguyên. */
export function nhanTo(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr`;
  if (n >= 1_000 && n % 100 === 0) return `${(n / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
  return dinhDang(n);
}

/** Bậc màu của một tờ = mệnh giá lớn nhất ≤ số của nó (một nguồn: `TO_TIEN`). */
function bacTo(n: number): (typeof TO_TIEN)[number] {
  let bac = TO_TIEN[0]!;
  for (const t of TO_TIEN) if (t.gt <= n) bac = t;
  return bac;
}

/**
 * Quy tắc tự chia thành một nhãn: "⟳ 50k/ngày" · "⟳ 10% tiền vào". `gon` = bản cho ô hũ trên kệ ("⟳ 10%") — ô hẹp,
 * và lá của hũ đã nói đủ câu.
 */
export function nhanTuDong(q: QuyTacTuDong, gon = false): string {
  if (q.kieu === 'ngay') return `${CP.tuDongDau}${nhanTo(q.gt)}${CP.moiNgayHau}`;
  return gon ? `${CP.tuDongDau}${q.gt}%` : `${CP.tuDongDau}${q.gt}${CP.phanTramHau}`;
}

/**
 * Ô TỜ ĐỨNG YÊN — thứ tự ô của khay nối từ lượt trước: ô cũ giữ nguyên chỗ (kể cả ô vừa hết tờ), mệnh giá MỚI xếp cuối.
 * Không bao giờ co, không bao giờ xếp lại giữa chừng.
 */
export function giuCho(cu: readonly number[], to: readonly ChongTo[]): number[] {
  const co = new Set(cu);
  return [...cu, ...to.map((t) => t.gt).filter((n) => !co.has(n))];
}

/** Các ô theo thứ tự đã giữ; mệnh giá không còn tờ nào ⇒ `dem: 0` (vẽ thành ô trống tại chỗ). */
export function oTheoCho(cho: readonly number[], to: readonly ChongTo[]): ChongTo[] {
  const m = new Map(to.map((t) => [t.gt, t]));
  return cho.map((n) => m.get(n) ?? { gt: n, dem: 0 });
}

/* ═══ trạng thái dùng chung ═════════════════════════════════════════════════ */

/** Cú đang chạy hiệu ứng ở MỘT hũ — `daToi` = hạt đã chạm thanh đo (hẹn giờ, không chờ `onfinish`). */
interface VuaNap { key: number; pctMoi: number | null; daToi: boolean }

/** Cửa sổ hoàn tác đang mở: câu hiện trên toast + cú gỡ. */
interface LuiNap { chu: string; lui: () => Promise<void> }

/**
 * Cú đang bay, chưa về sổ — đổi số NGAY lúc chạm, không chờ cú ghi. `gan` = phía CHI (hũ tiêu dùng): chia TRỪ phần chi
 * chưa chia · gỡ CỘNG nó và TRỪ hũ. Không `gan` = phía THU (hũ tích lũy): nạp TRỪ ví · rút CỘNG ví và TRỪ hũ.
 */
interface DangBay { soTien: number; rut: boolean; huId: string; gan: boolean }

/** Chiều của khay khi đang chọn một hũ: VÀO hũ (nạp / chia) · RA khỏi hũ (rút / gỡ). */
export type HuongKhay = 'nap' | 'rut';

/**
 * ⭐ THẺ QUY TẮC (D421) — không bao giờ tự biến mất giữa chừng: HỎI → (chia · bỏ qua) → KẾT QUẢ, nằm yên tới khi rời màn.
 * `tu` = app tự chia vì khớp (người dùng chưa bấm gì) · `false` = người dùng vừa bấm CHIA.
 */
export type TheQuyTac =
  | { loai: 'hoi'; d: DenHan }
  | { loai: 'da_chia'; khoan: readonly Khoan[]; tu: boolean }
  | { loai: 'bo_qua' }
  | { loai: 'hoan_tac'; tong: number };

export interface PhanBo {
  /** Có kệ + khay: chừng nào còn một hũ ĐANG CHẠY (D421 — chia hết không làm chúng biến mất). */
  hien: boolean;
  /** Hôm nay (`YYYY-MM-DD`) — ngày màn đọc một lần; tháng của hũ tiêu dùng suy từ đây. */
  ngay: string;
  huChay: readonly Hu[];
  huTichLuy: readonly Hu[];
  huTieuDung: readonly Hu[];
  chon: string | null;
  huChon: Hu | null;
  chonHu: (id: string) => void;
  /** Chiều của khay khi đang chọn hũ; đổi hũ là về chiều VÀO. */
  huong: HuongKhay;
  datHuong: (h: HuongKhay) => void;
  /** Ví lúc này (phía THU) — đã trừ cú nạp đang bay, cộng cú rút đang bay. */
  conLai: number;
  /** Tiền chi CHƯA CHIA tháng này (phía CHI) — đã trừ cú chia đang bay, cộng cú gỡ đang bay. */
  chiCon: number;
  /** Hũ đang chọn còn bao nhiêu cho chiều RA: tiền của hũ tích lũy · phần hũ tiêu dùng đã tiêu tháng này. */
  huCon: number;
  /** Tờ trên khay theo thứ tự ĐỨNG YÊN — gồm cả ô đã hết (`dem: 0`). */
  o: readonly ChongTo[];
  /** Con số trên ô hũ: ĐÃ GÓP (tích lũy) · ĐÃ TIÊU tháng này (tiêu dùng) — đã trừ cú ra đang bay. */
  soCua: (h: Hu) => number;
  /** Phiên này đã chia, và nguồn vừa về 0 — khay nói "ĐÃ CHIA HẾT" và ở lại. Thu (ví) · chi (tiền chi chưa chia). */
  daChiaHet: boolean;
  daChiaHetChi: boolean;
  vuaNap: Readonly<Record<string, VuaNap>>;
  lui: LuiNap | null;
  hoanTac: () => Promise<void>;
  /** Chuyển `soTien` theo chiều đang chọn ở hũ đang chọn (nạp/rút · chia/gỡ). `false` = không làm gì. */
  nap: (soTien: number, nguon: HTMLElement | null) => Promise<boolean>;
  the: TheQuyTac | null;
  /** Một câu trả lời đang chạy — nút của thẻ tắt, không cú chạm đôi nào chia hai lần. */
  dangTraLoi: boolean;
  traLoi: (cach: CachChay) => Promise<void>;
  hoanTacQuyTac: () => Promise<void>;
}

export function usePhanBo(hu: readonly Hu[], tatCa: readonly Khoan[], ngay: string, sanSang: boolean): PhanBo {
  const ghiKho = useGhiKho();
  const thang = ngay.slice(0, 7);
  const [chon, datChon] = useState<string | null>(null);
  const [huong, datHuongTho] = useState<HuongKhay>('nap');
  const [vuaNap, datVuaNap] = useState<Readonly<Record<string, VuaNap>>>({});
  const [daChia, datDaChia] = useState(false);
  const [daChiaChi, datDaChiaChi] = useState(false);
  const [lui, datLui] = useState<LuiNap | null>(null);
  const [the, datThe] = useState<TheQuyTac | null>(null);
  const [dangTraLoi, datDangTraLoi] = useState(false);
  const traLoiRef = useRef(false);
  /*
   * ⚠ CÚ ĐANG BAY: id khoản → cú chuyển. Số đổi NGAY lúc chạm, để chạm nhanh "500k ×2" hai lần thì cú thứ hai thấy ×1
   *   chứ không thấy lại ×2. Chỉ tính khi khoản ấy CHƯA có trong sổ ⇒ không bao giờ tính hai lần. ⚠ Dọn khi khoản ĐÃ VỀ
   *   SỔ (effect dưới), không dọn ngay sau cú ghi: giữa lúc ghi xong và lúc sổ đọc lại có một nhịp cả hai đều không đếm.
   */
  const [dangBay, datDangBay] = useState<ReadonlyMap<string, DangBay>>(() => new Map());
  const dem = useRef(0);
  const song = useRef(true);
  const hen = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    song.current = false;
    for (const h of hen.current) clearTimeout(h);
  }, []);
  const henGio = useCallback((f: () => void, ms: number): void => { hen.current.push(setTimeout(f, ms)); }, []);

  const huChay = useMemo(() => hu.filter((h) => h.trangThai === 'dang_chay'), [hu]);
  const huTichLuy = useMemo(() => huChay.filter(laTichLuy), [huChay]);
  const huTieuDung = useMemo(() => huChay.filter(laTieuDung), [huChay]);
  const idSo = useMemo(() => new Set(tatCa.map((k) => k.id)), [tatCa]);
  const viSo = useMemo(() => tienConLai(tatCa), [tatCa]);
  const chiSo = useMemo(() => chiChuaChia(tatCa, thang), [tatCa, thang]);
  const bay = useMemo(() => {
    let vi = 0;
    let chi = 0;
    const raHu = new Map<string, number>();
    for (const [id, b] of dangBay) {
      if (idSo.has(id)) continue;
      if (b.gan) chi += b.rut ? b.soTien : -b.soTien;
      else vi += b.rut ? b.soTien : -b.soTien;
      if (b.rut) raHu.set(b.huId, (raHu.get(b.huId) ?? 0) + b.soTien);
    }
    return { vi, chi, raHu };
  }, [dangBay, idSo]);
  const conLai = Math.max(0, viSo + bay.vi);
  const chiCon = Math.max(0, chiSo + bay.chi);
  const soCua = useCallback((h: Hu): number => (laTieuDung(h)
    ? daTieuTrongThang(tatCa, h.id, thang)
    : tongGopVaoHu(tatCa, h.id, h.mocGop)) - (bay.raHu.get(h.id) ?? 0), [tatCa, thang, bay]);

  /* Dọn cú bay đã VỀ SỔ (xem chú thích `dangBay`). */
  useEffect(() => {
    if ([...dangBay.keys()].some((id) => idSo.has(id))) {
      datDangBay((m) => {
        const n = new Map(m);
        for (const id of m.keys()) if (idSo.has(id)) n.delete(id);
        return n;
      });
    }
  }, [idSo, dangBay]);

  /* Hũ đang chọn mà không còn chạy (vừa đóng/tạm dừng) ⇒ coi như chưa chọn — SUY, không cất bản thứ hai. */
  const huChon = chon === null ? null : huChay.find((h) => h.id === chon) ?? null;
  const chonTieu = huChon !== null && laTieuDung(huChon);
  const huongHien: HuongKhay = huChon !== null ? huong : 'nap';
  const huCon = huChon !== null ? Math.max(0, soCua(huChon)) : 0;
  /** Nguồn của chiều VÀO: ví (hũ tích lũy) · tiền chi chưa chia (hũ tiêu dùng). */
  const nguonVao = chonTieu ? chiCon : conLai;

  /*
   * ⚠⚠ Ô TỜ ĐỨNG YÊN — luật "cố định và nhanh tiện" của founder (26/09, cho bàn tiền) áp cả khay: tờ cuối của một mệnh
   *   giá vừa chạm KHÔNG rời khay mà thành ô trống mờ tại chỗ. Không thì mọi tờ sau nó trượt sang trái, khay tụt một hàng,
   *   và cú chạm kế tiếp rơi vào tờ khác (đo trên bản build 26/09: tờ 70k dời chỗ và tụt 52px).
   *   PHIÊN CHẠM: chiều VÀO dùng chung một nguồn cho mọi hũ cùng loại (ví cho hũ tích lũy, tiền chi cho hũ tiêu dùng) ⇒ đổi
   *   qua hũ cùng loại vẫn giữ chỗ; chiều RA mỗi hũ một phiên (tờ là của CHÍNH hũ ấy). Đổi loại / bỏ chọn là hết phiên.
   *   Đặt state ngay trong lượt vẽ (mẫu "nhớ từ lượt vẽ trước" của React), không `useEffect`: không khung hình nào vẽ khay
   *   đã co rồi mới nở lại.
   */
  const toHien = useMemo(
    () => chiaTo(huongHien === 'rut' ? huCon : nguonVao, MENH_GIA), [huongHien, huCon, nguonVao],
  );
  const khoaTo = huChon === null ? null
    : huongHien === 'rut' ? `ra:${huChon.id}` : chonTieu ? 'vao:chi' : 'vao:thu';
  const [cho, datCho] = useState<{ khoa: string; gt: readonly number[] } | null>(null);
  const soCho = khoaTo === null ? [] : giuCho(cho !== null && cho.khoa === khoaTo ? cho.gt : [], toHien);
  if (khoaTo === null ? cho !== null : (cho === null || cho.khoa !== khoaTo || soCho.length !== cho.gt.length)) {
    datCho(khoaTo === null ? null : { khoa: khoaTo, gt: soCho });
  }
  const o = oTheoCho(soCho, toHien);

  const chonHu = useCallback((id: string) => {
    rung(NHIP_RUNG.cham);
    datChon((cu) => (cu === id ? null : id));
    datHuongTho('nap');   // đổi / bỏ chọn hũ ⇒ về chiều VÀO: RA là cú chủ ý, không mang sang hũ khác
  }, []);
  const datHuong = useCallback((h: HuongKhay) => { rung(NHIP_RUNG.cham); datHuongTho(h); }, []);

  /**
   * HẤP THỤ vào MỘT hũ: giữ số + thanh của hũ ở giá trị cũ, cho hạt bay từ `nguon()` (hẹn `tre` ms), tới nơi thì thanh
   * loé ở mốc mới và số chạy lên. `nguon` là hàm: nguồn của cú tự chia là thẻ quy tắc, mà thẻ có khi mới dựng ở lượt vẽ tới.
   */
  const hapThu = useCallback((h: Hu, soTien: number, nguon: () => HTMLElement | null, tre: number) => {
    const itMotion = itChuyenDong();
    const den = soCua(h) + soTien;
    const pctMoi = h.muc !== null && h.muc > 0 ? Math.max(0, Math.min(1, den / h.muc)) : null;
    const key = ++dem.current;
    datVuaNap((v) => ({ ...v, [h.id]: { key, pctMoi, daToi: itMotion } }));
    if (itMotion) return;
    henGio(() => {
      const dich = diemDich(h.id, pctMoi);
      const n = nguon();
      if (n !== null) bayHat(n, dich, bacTo(soTien).m);
      henGio(() => {
        datVuaNap((v) => (v[h.id]?.key === key ? { ...v, [h.id]: { ...v[h.id]!, daToi: true } } : v));
        phutHat(dich, 'var(--gold)', 12);
      }, NHIP.PFM_HAP_THU_BAY);
    }, tre);
  }, [soCua, henGio]);

  /**
   * RA khỏi hũ (rút / gỡ) — hũ NHẢ một hạt về đúng tờ vừa chạm trên khay. Số của hũ tụt NGAY (`soCua` đã trừ cú đang
   * bay), ô hũ loé một nhịp; không giữ số ở giá trị cũ như lúc vào.
   */
  const nhaRa = useCallback((h: Hu, soTien: number, dich: HTMLElement | null) => {
    const key = ++dem.current;
    datVuaNap((v) => ({ ...v, [h.id]: { key, pctMoi: null, daToi: true } }));
    if (itChuyenDong() || dich === null || typeof document === 'undefined') return;
    const nguon = document.querySelector<HTMLElement>(`[data-ke-hu="${h.id}"] [data-so]`);
    if (nguon === null) return;
    const r = dich.getBoundingClientRect();
    bayHat(nguon, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, bacTo(soTien).m);
  }, []);

  /** Mở cửa sổ hoàn tác 4 giây (cùng số với bàn tiền); chỉ đóng ĐÚNG cú này, không đóng cú sau. */
  const moLui = useCallback((l: LuiNap) => {
    datLui(l);
    henGio(() => datLui((cu) => (cu === l ? null : cu)), HOAN_TAC_MS);
  }, [henGio]);

  /** Khoảnh khắc "chia hết": một chùm hạt vàng bung ra đúng lúc hạt cuối chạm hũ. Chữ "ĐÃ CHIA HẾT" ở lại (D421). */
  const buiVang = useCallback(() => {
    henGio(() => phutHat(tamPhanTu(document.querySelector('[data-testid="khay-phan-bo"]')), 'var(--gold)', 18),
      NHIP.PFM_HAP_THU_BAY + 60);
  }, [henGio]);

  const nap = useCallback(async (soTien: number, nguon: HTMLElement | null): Promise<boolean> => {
    const h = huChon;
    if (h === null || !Number.isSafeInteger(soTien) || soTien <= 0) return false;
    const gan = laTieuDung(h);
    const rut = huongHien === 'rut';
    if (soTien > (rut ? huCon : gan ? chiCon : conLai)) return false;
    const id = sinhId();
    const k = taoKhoanPhanBo(
      { ngay, soTien, huId: h.id, phanBo: gan ? 'gan' : 'tay', chieu: rut ? 'thu' : 'chi' }, bayGio(), id,
    );
    rung(NHIP_RUNG.nang);
    datDangBay((m) => new Map(m).set(id, { soTien, rut, huId: h.id, gan }));
    if (rut) nhaRa(h, soTien, nguon);
    else hapThu(h, soTien, () => nguon, 0);
    let conSau: number | null = null;
    try {
      if (gan) conSau = (await ghiKho(['khoan'], (kho) => ganKhoanKho(kho, k)))?.chiCon ?? null;
      else conSau = (await ghiKho(['khoan'], (kho) => napKhoanKho(kho, k)))?.conLai ?? null;
    } catch {
      conSau = null;
    }
    if (conSau === null) {   // nguồn / hũ vừa đổi dưới tay (quy tắc tự chia, máy khác) — không chuyển quá phần đang có
      datDangBay((m) => { const n = new Map(m); n.delete(id); return n; });
      return false;
    }
    const ten = h.ten.toUpperCase();
    const [truoc, giua] = gan
      ? (rut ? [CP.daGoPre, CP.daGoGiua] : [CP.daChiaPre, CP.daChiaGiua])
      : (rut ? [CP.daRutPre, CP.daRutGiua] : [CP.daNapPre, CP.daNapGiua]);
    moLui({
      chu: `${truoc}${dinhDang(soTien)}${giua}${ten}`,
      lui: () => ghiKho(['khoan'], (kho) => kho.xoa('khoan', id, bayGio())),
    });
    if (!rut) {
      if (gan) datDaChiaChi(true); else datDaChia(true);
      if (conSau === 0) buiVang();
    }
    return true;
  }, [huChon, huongHien, huCon, chiCon, conLai, ngay, hapThu, nhaRa, ghiKho, moLui, buiVang]);

  /** Cho những khoản quy tắc vừa chia bay vào từng hũ, lần lượt, TỪ thẻ quy tắc; thẻ thành THẺ KẾT QUẢ (không toast). */
  const hienTuChia = useCallback((khoan: readonly Khoan[], tu: boolean) => {
    const nguon = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-testid="the-quy-tac"]')
      ?? document.querySelector<HTMLElement>('[data-testid="khay-phan-bo"]');
    khoan.forEach((k, i) => {
      const h = hu.find((x) => x.id === k.huId);
      if (h !== undefined) hapThu(h, k.soTien, nguon, i * NHIP.PFM_TU_CHIA_CACH);
    });
    datDaChia(true);
    datThe({ loai: 'da_chia', khoan, tu });
  }, [hapThu, hu]);

  /*
   * ⭐ QUY TẮC TỰ CHIA chạy khi màn mở (và khi quy tắc/mốc đổi): KHỚP ⇒ tự chia + thẻ kết quả có HOÀN TÁC · THIẾU/THỪA ⇒
   *   thẻ hỏi. Không còn gì đến hạn ⇒ KHÔNG đụng thẻ: thẻ kết quả của lượt trước ở lại (D421).
   * ⚠ Không huỷ theo lượt effect: chính cú chia làm mốc tiến ⇒ `khoaQuyTac` đổi ⇒ effect chạy lại TRƯỚC khi cú đầu kịp
   *   vẽ hạt bay. Chỉ dừng khi màn đã gỡ (`song`). Lượt chạy lại đọc thấy mốc đã tiến ⇒ không còn gì đến hạn ⇒ im.
   * ⚠ Qua ref: `hienTuChia` đổi theo MỖI lần sổ đổi (nó cầm `soCua`) — để nó trong deps là mỗi cú nạp tay lại chạy quy
   *   tắc. Effect chỉ chạy lại khi QUY TẮC hoặc MỐC đổi.
   */
  const hienTuChiaRef = useRef(hienTuChia);
  hienTuChiaRef.current = hienTuChia;
  const khoaQuyTac = useMemo(() => hu
    .filter((h) => h.tuDong !== undefined && laTichLuy(h))
    .map((h) => `${h.id}:${h.trangThai}:${h.tuDong!.kieu}:${h.tuDong!.gt}:${h.tuDong!.chayToi ?? ''}:${h.tuDong!.moc ?? ''}`)
    .join('|'), [hu]);
  useEffect(() => {
    if (!sanSang || khoaQuyTac === '') return;
    void (async () => {
      try {
        const kq = await ghiKho(['khoan', 'hu'], (kho) => chayTuDongKho(kho, ngay, bayGio(), 'hoi', sinhId, thangNay()));
        if (!song.current) return;
        if (kq.khoan.length > 0) { hienTuChiaRef.current(kq.khoan, true); return; }
        const kqHoi = kq.denHan.ketQua;
        if (kqHoi === 'thieu' || kqHoi === 'thua') datThe({ loai: 'hoi', d: kq.denHan });
      } catch { /* kho chưa mở / vừa đóng — lần mở màn sau chạy lại */ }
    })();
  }, [sanSang, khoaQuyTac, ngay, ghiKho]);

  const traLoi = useCallback(async (cach: CachChay) => {
    if (traLoiRef.current) return;
    traLoiRef.current = true;
    datDangTraLoi(true);
    rung(cach === 'bo_qua' ? NHIP_RUNG.cham : NHIP_RUNG.nang);
    try {
      const kq = await ghiKho(['khoan', 'hu'], (kho) => chayTuDongKho(kho, ngay, bayGio(), cach, sinhId, thangNay()));
      if (!song.current) return;
      if (cach === 'bo_qua') datThe({ loai: 'bo_qua' });
      else if (kq.khoan.length > 0) hienTuChia(kq.khoan, false);
      else datThe(null);   // lượt khác vừa chạy xong đúng phần này — không còn gì để nói
    } catch {
      /* ví vừa đổi dưới tay (thiếu mà chọn chia đủ) ⇒ không chia; thẻ HỎI ở lại để chọn lại */
    } finally {
      traLoiRef.current = false;
      if (song.current) datDangTraLoi(false);
    }
  }, [ghiKho, hienTuChia, ngay]);

  /** HOÀN TÁC một lượt quy tắc — gỡ đúng các khoản của lượt ấy; mốc KHÔNG lùi (lượt đó không chia lại). */
  const hoanTacQuyTac = useCallback(async () => {
    if (the?.loai !== 'da_chia') return;
    rung(NHIP_RUNG.cham);
    const khoan = the.khoan;
    datThe({ loai: 'hoan_tac', tong: khoan.reduce((a, k) => a + k.soTien, 0) });
    await ghiKho(['khoan'], async (kho) => { for (const k of khoan) await kho.xoa('khoan', k.id, bayGio()); });
  }, [the, ghiKho]);

  const hoanTac = useCallback(async () => {
    if (lui === null) return;
    rung(NHIP_RUNG.cham);
    const l = lui;
    datLui(null);
    await l.lui();
  }, [lui]);

  return {
    hien: huChay.length > 0,
    ngay, huChay, huTichLuy, huTieuDung, chon: huChon?.id ?? null, huChon, chonHu,
    huong: huongHien, datHuong, conLai, chiCon, huCon, o, soCua,
    daChiaHet: daChia && conLai === 0,
    daChiaHetChi: daChiaChi && chiCon === 0,
    vuaNap, lui, hoanTac, nap, the, dangTraLoi, traLoi, hoanTacQuyTac,
  };
}

/* ═══ hiệu ứng: co lại thành hạt, bay vút vào thanh đo ════════════════════════ */

interface Diem { x: number; y: number }

/** Điểm hạt sẽ chạm: đúng MỐC MỚI trên thanh đo của hũ; hũ chưa mức ⇒ giữa con số. */
function diemDich(huId: string, pctMoi: number | null): Diem | null {
  if (typeof document === 'undefined') return null;
  const o = document.querySelector<HTMLElement>(`[data-ke-hu="${huId}"]`);
  if (o === null) return null;
  const thanh = o.querySelector<HTMLElement>('[data-thanh]');
  if (thanh !== null && pctMoi !== null) {
    const r = thanh.getBoundingClientRect();
    return { x: r.left + r.width * pctMoi, y: r.top + r.height / 2 };
  }
  const so = o.querySelector<HTMLElement>('[data-so]') ?? o;
  const r = so.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * ⭐ TỜ CO LẠI THÀNH MỘT HẠT SÁNG RỒI BAY VÚT VÀO THANH ĐO. Một bản sao gắn vào `body` (nằm ngoài mọi `overflow`),
 * ba nhịp trong MỘT animation: co (nảy nhẹ) → vọt lên theo cung → lao vào điểm mốc (tăng tốc).
 * ⚠ Dọn bằng đồng hồ, không chờ `onfinish` (xem đầu tệp).
 */
function bayHat(nguon: HTMLElement, dich: Diem | null, mau: string): void {
  if (dich === null || typeof document === 'undefined') return;
  const r = nguon.getBoundingClientRect();
  const dx = dich.x - (r.left + r.width / 2);
  const dy = dich.y - (r.top + r.height / 2);
  /* Hạt chính + hai bóng ĐUÔI đi cùng quỹ đạo, trễ một nhịp, nhỏ và mờ dần — thành một vệt "vút" chứ không phải một
     chấm trôi. Bóng đuôi chỉ bay, không co ra từ tờ (tờ chỉ co một lần). */
  const DUOI = [
    { tre: 0, co: 1, mo: 1 },
    { tre: 45, co: 0.72, mo: 0.55 },
    { tre: 90, co: 0.5, mo: 0.3 },
  ] as const;
  for (const d of DUOI) {
    const c = document.createElement('i');
    c.setAttribute('aria-hidden', 'true');
    c.className = s.hat ?? '';
    c.style.left = `${r.left + r.width / 2 - 7}px`;
    c.style.top = `${r.top + r.height / 2 - 7}px`;
    c.style.opacity = '0';
    c.style.setProperty('--mau', mau);
    document.body.appendChild(c);
    if (typeof c.animate === 'function') {
      c.animate([
        { transform: `translate(0,0) scale(${d.tre === 0 ? 4.2 : 1.25 * d.co})`, opacity: d.tre === 0 ? 0.2 : 0, easing: 'cubic-bezier(.34,1.56,.64,1)' },
        { transform: `translate(0,-6px) scale(${1.25 * d.co})`, opacity: d.mo, offset: 0.26, easing: 'cubic-bezier(.3,0,.7,.4)' },
        { transform: `translate(${dx * 0.35 - 18}px,${dy * 0.45 - 34}px) scale(${d.co})`, opacity: d.mo, offset: 0.6, easing: 'cubic-bezier(.55,0,.9,.3)' },
        { transform: `translate(${dx}px,${dy}px) scale(${0.55 * d.co})`, opacity: d.tre === 0 ? 0.95 : 0 },
      ], { duration: NHIP.PFM_HAP_THU_BAY, delay: d.tre, fill: 'both' });
    }
    setTimeout(() => c.remove(), NHIP.PFM_HAP_THU_BAY + d.tre + 60);
  }
}

/**
 * Giá trị số-chạy tại tiến độ `p` (0…1), ease-out bậc ba. ⚠ KẸP CẢ HAI ĐẦU: mốc của rAF là lúc khung BẮT ĐẦU, có thể
 * sớm hơn `performance.now()` lúc hẹn ⇒ `p` âm ⇒ số TỤT dưới số cũ một khung (đo 26/09: 1.000.000 → 997.694 →
 * 1.001.296) — một con số tiền đi lùi ngay trong cú "nạp" là đúng thứ làm người ta mất tin vào con số.
 */
export function soChayTai(tu: number, den: number, p: number): number {
  const q = Math.max(0, Math.min(1, p));
  return Math.round(tu + (den - tu) * (1 - (1 - q) ** 3));
}

/**
 * SỐ CHẠY (count-up / count-down) — hiện số cũ tới khi hạt chạm thanh đo (`giu`), rồi chạy tới số mới trong
 * `PFM_DEM_SO`. ⚠ rAF không chạy khi khung ẩn ⇒ có hẹn CHỐT: hết giờ là số cuối, không bao giờ kẹt ở giữa.
 */
function useSoChay(so: number, giu: boolean): number {
  const [hien, datHien] = useState(so);
  const hienRef = useRef(so);
  hienRef.current = hien;
  useEffect(() => {
    if (giu || hienRef.current === so) return undefined;
    if (itChuyenDong()) { datHien(so); return undefined; }
    /*
     * ⚠⚠ BƯỚC HẸN GIỜ CỐ ĐỊNH, KHÔNG VÒNG rAF. Bản đầu chạy theo mốc của `requestAnimationFrame`: mốc ấy lệch đồng hồ
     *   `performance.now()` (khung đầu ra số ÂM — xem `soChayTai`) và rAF đứng hẳn khi khung ẩn; bài test bắt một lượt
     *   dừng ở 19.649 thay vì 20.000. Chia `PFM_DEM_SO` thành các bước ~16ms theo CHỈ SỐ bước (không theo đồng hồ) ⇒
     *   bước cuối đặt ĐÚNG số mới, chắc chắn; khung ẩn thì trình duyệt chỉ giãn hẹn chứ không bỏ.
     */
    const tu = hienRef.current;
    const n = Math.max(1, Math.round(NHIP.PFM_DEM_SO / 16));
    const hen: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= n; i += 1) {
      hen.push(setTimeout(() => datHien(soChayTai(tu, so, i / n)), (NHIP.PFM_DEM_SO * i) / n));
    }
    return () => { for (const h of hen) clearTimeout(h); };
  }, [so, giu]);
  return hien;
}

/* ═══ KỆ HŨ — đầu màn ═══════════════════════════════════════════════════════ */

export function KeHuPhanBo({ pb }: { pb: PhanBo }): React.ReactElement {
  const [moGiai, datMoGiai] = useState(false);
  return (
    <section className={s.ke} data-testid="ke-phan-bo" aria-label={CP.tieu}>
      <div className={s.dauKe}>
        <span className={s.tieu}>{CP.tieu}</span>
        <button
          type="button" className={s.hoi} aria-expanded={moGiai} aria-label={CP.tieu}
          onClick={() => datMoGiai((v) => !v)}
        >
          {moGiai ? '✕' : '?'}
        </button>
      </div>
      {moGiai && <p className={s.giai}>{CP.giai}</p>}
      {pb.the !== null && <TheQuyTacKe the={pb.the} pb={pb} />}
      {pb.huChay.length === 0 ? (
        <p className={s.goiY}>{CP.chuaCoHu}</p>
      ) : (
        <>
          {/* D421 — hai nhóm, TIÊU DÙNG trên (việc mỗi tối), TÍCH LŨY dưới — đúng hình founder chốt ở câu đóng 26/09. */}
          {pb.huTieuDung.length > 0 && (
            <>
              <p className={`${s.nhomKe} ${s.nhomTieu}`}>{`${CP.keTieuDungPre}${Number(pb.ngay.slice(5, 7))}`}</p>
              <div className={s.luoiHu} data-testid="ke-tieu-dung">
                {pb.huTieuDung.map((h) => <OHu key={h.id} h={h} pb={pb} />)}
              </div>
            </>
          )}
          {pb.huTichLuy.length > 0 && (
            <>
              <p className={s.nhomKe}>{CP.keTichLuy}</p>
              <div className={s.luoiHu} data-testid="ke-tich-luy">
                {pb.huTichLuy.map((h) => <OHu key={h.id} h={h} pb={pb} />)}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * ⭐ THẺ QUY TẮC TỰ CHIA (founder: *"nếu thiếu hoặc thừa thì app sẽ hỏi chứ ko tự phân bổ"*). Tả con số + đưa lựa chọn;
 * không lựa chọn nào được đánh dấu "nên" (A10). D421: KHÔNG ✕ — trả lời xong thẻ thành kết quả tại chỗ, không biến mất.
 */
function TheQuyTacKe({ the, pb }: { the: TheQuyTac; pb: PhanBo }): React.ReactElement {
  const tenHu = (id: string | null): string => pb.huChay.find((x) => x.id === id)?.ten.toUpperCase() ?? '—';
  let tieuDe: string;
  let than: React.ReactNode;
  if (the.loai === 'hoi') {
    const d = the.d;
    const thieu = d.ketQua === 'thieu';
    const tiLe = phanTiLe(d).reduce((a, n) => a + n, 0);
    tieuDe = `${CP.tuDongDau}${CP.hoiTieu}`;
    const cau = thieu
      ? `${CP.thieuDenHanPre}${dinhDang(d.tong)}${CP.thieuConPre}${dinhDang(d.conLai)}${CP.thieuThieuPre}${dinhDang(d.thieu)}.`
      : `${CP.thuaVaoPre}${dinhDang(d.tienVaoMoi)}${CP.thuaVaoHau}${d.tong > 0
        ? `${CP.thuaChiaPre}${dinhDang(d.tong)}${CP.thuaConPre}${dinhDang(d.conLai - d.tong)}${CP.thuaConHau}`
        : CP.thuaChuaQuy}`;
    const phanCo = d.phan.filter((p) => p.soTien > 0);
    than = (
      <>
        <p className={s.cauHoi}>{cau}</p>
        {phanCo.length > 0 && (
          <ul className={s.dongPhan}>
            {phanCo.map((p) => (
              <li key={p.huId}><span>{tenHu(p.huId)}</span><b>{dinhDang(p.soTien)}</b></li>
            ))}
          </ul>
        )}
        <div className={s.nutHoiHang}>
          {thieu
            ? tiLe > 0 && (
              <button
                type="button" className={s.nutHoiChinh} disabled={pb.dangTraLoi} onClick={() => void pb.traLoi('ti_le')}
              >
                {`${CP.nutChiaPre}${dinhDang(tiLe)}${CP.nutTiLeHau}`}
              </button>
            )
            : d.tong > 0 && (
              <button
                type="button" className={s.nutHoiChinh} disabled={pb.dangTraLoi} onClick={() => void pb.traLoi('du')}
              >
                {`${CP.nutChiaPre}${dinhDang(d.tong)}${CP.nutChiaHau}`}
              </button>
            )}
          <button
            type="button" className={s.nutHoiPhu} disabled={pb.dangTraLoi} onClick={() => void pb.traLoi('bo_qua')}
          >
            {d.tong > 0 ? CP.nutBoQua : CP.nutDeDo}
          </button>
        </div>
      </>
    );
  } else if (the.loai === 'da_chia') {
    const tong = the.khoan.reduce((a, k) => a + k.soTien, 0);
    tieuDe = `✓ ${the.tu ? CP.daTuChiaTieu : CP.daChiaTieu}`;
    than = (
      <>
        <ul className={s.dongPhan}>
          {the.khoan.map((k) => (
            <li key={k.id}><span>{tenHu(k.huId)}</span><b>{dinhDang(k.soTien)}</b></li>
          ))}
        </ul>
        <div className={s.nutHoiHang}>
          <span className={s.tongChia}>{`${CP.tongChiaPre}${dinhDang(tong)}${CP.loiHau}`}</span>
          <button type="button" className={s.nutHoiPhu} onClick={() => void pb.hoanTacQuyTac()}>
            {CHU_MAN_SO.nutHoanTac}
          </button>
        </div>
      </>
    );
  } else if (the.loai === 'bo_qua') {
    tieuDe = CP.daBoQuaTieu;
    than = <p className={s.cauHoi}>{CP.daBoQuaChu}</p>;
  } else {
    tieuDe = CP.daHoanTacTieu;
    than = <p className={s.cauHoi}>{`${dinhDang(the.tong)}${CP.daHoanTacHau}`}</p>;
  }
  return (
    <div
      className={s.theHoi} role="group" aria-label={CP.hoiTieu} data-testid="the-quy-tac" data-trang-thai={the.loai}
      data-ket-qua={the.loai === 'hoi' ? the.d.ketQua : undefined}
    >
      <div className={s.dauHoi}><b>{tieuDe}</b></div>
      {than}
    </div>
  );
}

function OHu({ h, pb }: { h: Hu; pb: PhanBo }): React.ReactElement {
  const tieu = laTieuDung(h);
  const that = pb.soCua(h);
  const vn = pb.vuaNap[h.id] ?? null;
  // ⚠ Giữ số (và thanh) ở giá trị CŨ tới khi hạt chạm — thanh đo "hấp thụ" chứ không nhảy trước khi hạt bay tới.
  const hien = useSoChay(that, vn !== null && !vn.daToi);
  const p = tienDo(h, hien);
  const pct = p === null ? 0 : Math.round(p * 100);
  const chon = pb.chon === h.id;
  return (
    <button
      type="button"
      className={`${s.oHu} ${tieu ? s.oTieu : ''} ${chon ? s.dangChon : ''}`}
      aria-pressed={chon}
      data-ke-hu={h.id}
      data-nhom={tieu ? 'tieu_dung' : 'tich_luy'}
      onClick={() => pb.chonHu(h.id)}
    >
      {chon && <span className={s.quangChon} aria-hidden="true" />}
      {vn !== null && vn.daToi && <span key={vn.key} className={s.quangNap} aria-hidden="true" />}
      {/* Nhãn quy tắc DÁN lên mép trên ô (như số lượng trên tờ tiền) — không ăn chỗ của tên hũ. */}
      {!tieu && h.tuDong !== undefined && <span className={s.tuDongO}>{nhanTuDong(h.tuDong, true)}</span>}
      <span className={s.ruotO}>
        <span className={s.dongTen}>
          <PixelIcon name={h.icon} size={16} className={s.icon} />
          <span className={s.tenO}>{h.ten.toUpperCase()}</span>
        </span>
        <span className={s.thanhO} data-thanh="">
          <ThanhTienDo pct={pct} nhan={`${h.ten}: ${p === null ? CP.chuaMuc : `${pct}%`}`} />
          {vn !== null && vn.daToi && vn.pctMoi !== null && (
            <i key={vn.key} className={s.loe} style={{ left: `${vn.pctMoi * 100}%` }} aria-hidden="true" />
          )}
        </span>
        <span className={s.dongSo}>
          <b className={s.soO} data-so="">{dinhDang(hien)}</b>
          <span className={s.phuO}>{h.muc !== null ? `/ ${nhanTo(h.muc)}` : CP.chuaMuc}</span>
        </span>
      </span>
    </button>
  );
}

/* ═══ KHAY — góc dưới, trong thanh neo đáy ═══════════════════════════════════ */

/** Ô hũ đang chọn phải nằm cách mép trên khay ít nhất chừng này (px): toast hoàn tác (~52px) + một khe thở. */
const KHOANG_TREN_KHAY = 64;

/**
 * Chữ của khay theo LOẠI hũ đang chọn × CHIỀU — một bảng, để phía THU và phía CHI đi đúng một khuôn (D424: *"giống thu"*).
 * `nhanVao`/`nhanRa` = hai nút chiều · `nhom` = nhãn nhóm tờ · `goPre` = nút xác nhận số gõ · `vuot*` = câu khi gõ quá.
 */
function chuKhay(tieu: boolean, rut: boolean) {
  if (tieu) {
    return {
      nhanVao: CP.huongChia, nhanRa: CP.huongGo,
      nhom: rut ? CP.goKhoiPre : CP.chiaVaoPre,
      to: rut ? CP.toGo : CP.toChia, toHet: rut ? CP.toGoHet : CP.toChiaHet,
      goPre: rut ? CP.goGoPre : CP.chiaGoPre,
      vuotPre: rut ? CP.vuotGoPre : CP.vuotChiPre, vuotHau: rut ? CP.vuotGoHau : CP.vuotChiHau,
    };
  }
  return {
    nhanVao: CP.huongNap, nhanRa: CP.huongRut,
    nhom: rut ? CP.rutTuPre : CP.napVaoPre,
    to: rut ? CP.toRut : CP.toNap, toHet: rut ? CP.toRutHet : CP.toHet,
    goPre: rut ? CP.rutGoPre : CP.napGoPre,
    vuotPre: rut ? CP.vuotHuPre : CP.vuotViPre, vuotHau: rut ? CP.vuotHuHau : CP.vuotViHau,
  };
}

export function KhayPhanBo({ pb }: { pb: PhanBo }): React.ReactElement {
  /*
   * Đã chọn hũ = đang giữa một chuỗi chạm ⇒ khai "đang thao tác" để bong bóng Oracle nhường chỗ (chỉ thị founder
   * 06/09, `lib/thao_tac.ts`): neo mặc định của nó đè mép phải hàng tờ đầu ở màn 375px, và thứ mờ vẫn ăn cú chạm.
   */
  useDangThaoTac(pb.chon !== null);
  /*
   * D421 — khay NỞ LÊN từ đáy khi chọn hũ, và có thể trùm lên chính ô hũ vừa chạm ở hàng dưới của kệ (đo trên bản build
   * 375px: ô XE MÁY nằm trọn dưới khay) — hạt bay vào một ô không ai thấy. Ô bị che thì cuộn trang lên VỪA ĐỦ để ô lộ ra
   * trên mép khay; ô đã thấy thì không cuộn (không gì xê dịch dưới ngón tay vô cớ). Khay neo đáy nên cú chạm kế tiếp —
   * vào tờ — không đổi chỗ.
   * ⚠ Chừa cả chỗ cho TOAST hoàn tác (nổi ngay trên mép khay, ~52px): soi bản build D424 thấy toast "Đã chia 500.000 vào
   *   ĂN UỐNG" đè đúng con số đang chạy lên của ô vừa nhận tờ — cú "hấp thụ" diễn ra sau tấm toast.
   */
  const khayRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (pb.chon === null || khayRef.current === null || typeof window.scrollBy !== 'function') return;
    const o = document.querySelector<HTMLElement>(`[data-ke-hu="${pb.chon}"]`);
    if (o === null) return;
    const mep = khayRef.current.getBoundingClientRect().top;
    const r = o.getBoundingClientRect();
    if (mep === 0 && r.bottom === 0) return;   // chưa có bố cục (môi trường không vẽ)
    const che = r.bottom + KHOANG_TREN_KHAY - mep;
    if (che > 0) window.scrollBy({ top: che, behavior: itChuyenDong() ? 'auto' : 'smooth' });
  }, [pb.chon, pb.huong]);
  /* GÕ SỐ (founder: *"nhập tay số tiền nếu muốn nhanh và chính xác tuyệt đối"*): `null` = đang bày tờ. */
  const [go, datGo] = useState<string | null>(null);
  // đổi / bỏ chọn hũ, đổi chiều ⇒ về bày tờ: không mang số đang gõ sang hũ khác hay sang chiều khác
  useEffect(() => { datGo(null); }, [pb.chon, pb.huong]);
  const huChon = pb.huChon;
  const tieu = huChon !== null && laTieuDung(huChon);
  const rut = huChon !== null && pb.huong === 'rut';
  const chu = chuKhay(tieu, rut);
  /** Số tối đa của chiều đang chọn: ví / tiền chi chưa chia (VÀO) · phần của hũ (RA). */
  const tran = huChon === null ? 0 : rut ? pb.huCon : tieu ? pb.chiCon : pb.conLai;
  const soGo = go === null || go === '' ? 0 : Number(go);
  const moGo = huChon !== null && go !== null;
  const vuot = soGo > tran;
  const coTich = pb.huTichLuy.length > 0;
  const coTieu = pb.huTieuDung.length > 0;

  async function napGo(nut: HTMLElement): Promise<void> {
    if (soGo <= 0 || vuot) return;
    if (await pb.nap(soGo, nut)) datGo(null);
  }

  const xongHet = (chi: boolean): React.ReactElement => (
    <p className={s.xong} data-testid="phan-bo-xong">
      <b>{`✦ ${chi ? CP.xongHetChi : CP.xongHet}`}</b>
      <span>{chi ? CP.xongHetChiPhu : CP.xongHetPhu}</span>
    </p>
  );
  /* Chưa chọn hũ: nói đúng việc làm được với những hũ ĐANG CÓ — không gợi loại hũ người dùng chưa tạo. */
  const goiYChon = coTich && coTieu
    ? (pb.conLai > 0 || pb.chiCon > 0 ? CP.chonHuCaHai : CP.khongCoGi)
    : coTieu
      ? (pb.chiCon > 0 ? CP.chonHuTieu : CP.chiTrong)
      : (pb.conLai > 0 ? CP.chonHu : CP.viTrong);

  let than: React.ReactNode;
  if (huChon === null) {
    than = <p className={s.goiY}>{goiYChon}</p>;
  } else if (moGo) {
    than = (
      <div className={s.goSo} data-testid="go-so-phan-bo">
        <div className={s.hangGo}>
          <b className={`${s.soGo} ${soGo === 0 ? s.soGoRong : ''}`}>{dinhDang(soGo)}</b>
          <button
            type="button" className={s.nutNapGo} disabled={soGo <= 0 || vuot}
            onClick={(e) => void napGo(e.currentTarget)}
          >
            {`${chu.goPre}${dinhDang(soGo)}`}
          </button>
        </div>
        {vuot && <p className={s.vuot} role="alert">{`${chu.vuotPre}${dinhDang(tran)}${chu.vuotHau}`}</p>}
        <BanPhim
          luonHien
          onSo={(d) => { rung(NHIP_RUNG.cham); datGo((g) => { const v = `${g ?? ''}${d}`.replace(/^0+/, ''); return v.length > 12 ? g : v; }); }}
          onXoa={() => { rung(NHIP_RUNG.cham); datGo((g) => (g ?? '').slice(0, -1)); }}
        />
      </div>
    );
  } else if (tran === 0 && pb.o.every((t) => t.dem === 0)) {
    than = tieu
      ? (rut ? <p className={s.goiY}>{CP.huChuaTieu}</p> : pb.daChiaHetChi ? xongHet(true) : <p className={s.goiY}>{CP.chiTrong}</p>)
      : (rut ? <p className={s.goiY}>{CP.huTrong}</p> : pb.daChiaHet ? xongHet(false) : <p className={s.goiY}>{CP.viTrong}</p>);
  } else {
    than = (
      <div
        className={s.dongTo} role="group" aria-label={`${chu.nhom}${huChon.ten}`}
        data-huong={rut ? 'rut' : 'nap'} data-testid="to-khay"
      >
        {pb.o.map((t) => {
          const bac = bacTo(t.gt);
          const het = t.dem === 0;
          const le = t.le === true || t.gt < TO_NHO_NHAT;
          return (
            <button
              key={t.gt}
              type="button"
              className={s.to}
              disabled={het}
              style={{ '--m': bac.m, '--bam': bac.bam } as React.CSSProperties}
              aria-label={`${CP.toTen}${dinhDang(t.gt)} ×${t.dem}${het ? chu.toHet : chu.to}`}
              onClick={(e) => void pb.nap(t.gt, e.currentTarget)}
            >
              <span className={s.soTo}>{le ? `${dinhDang(t.gt)}${CP.donViLe}` : nhanTo(t.gt)}</span>
              <b className={s.demTo}>{`×${t.dem}`}</b>
            </button>
          );
        })}
      </div>
    );
  }

  /* D453 — khay RỖNG = không có gì để chia ở CẢ HAI phía mà khay chia được: ví (tích lũy) · chi chưa chia (chỉ khi có hũ
     tiêu dùng nhận nó). Không hũ nào đang chọn, không thẻ quy tắc nào đang mở. */
  const khayRong = huChon === null && pb.the === null && pb.conLai <= 0
    && (pb.chiCon <= 0 || pb.huTieuDung.length === 0);
  return (
    <div
      ref={khayRef} className={`${s.khay} ${khayRong ? s.khayRong : ''}`}
      data-testid="khay-phan-bo"
      data-nhom={huChon === null ? undefined : tieu ? 'tieu_dung' : 'tich_luy'}
      data-huong={huChon === null ? undefined : pb.huong}
    >
      {pb.lui !== null && (
        <div className={s.toast} role="status">
          <span>{pb.lui.chu}</span>
          <button type="button" onClick={() => void pb.hoanTac()}>{CHU_MAN_SO.nutHoanTac}</button>
        </div>
      )}
      <span className={s.quang} aria-hidden="true" />
      <div className={s.ruotKhay}>
        <div className={s.dauKhay}>
          <span className={s.nhanKhay}>
            {huChon !== null ? huChon.ten.toUpperCase() : `${CP.khayPre}${dinhDang(pb.conLai)}${CP.loiHau}`}
          </span>
          {huChon === null ? coTieu && (
            <span className={s.conKhay} data-testid="chi-con">{`${CP.khayChiPre}${dinhDang(pb.chiCon)}${CP.loiHau}`}</span>
          ) : rut ? (
            <span className={s.conKhay} data-testid="hu-con">
              {`${tieu ? CP.huDaTieuPre : CP.huConPre}${dinhDang(pb.huCon)}${CP.loiHau}`}
            </span>
          ) : tieu ? (
            <span className={s.conKhay} data-testid="chi-con">{`${CP.chiConPre}${dinhDang(pb.chiCon)}${CP.loiHau}`}</span>
          ) : (
            <span className={s.conKhay} data-testid="vi-con">{`${CP.viConPre}${dinhDang(pb.conLai)}${CP.loiHau}`}</span>
          )}
        </div>
        {huChon !== null && (
          <div className={s.hangHuong}>
            {/* ⭐ Hai chiều của MỌI hũ (D421 → D424): VÀO hũ (nạp tiền còn lại · chia tiền chi) · RA khỏi hũ (rút · gỡ). */}
            <div className={s.huong} role="group" aria-label={huChon.ten}>
              <button type="button" className={s.nutHuong} aria-pressed={!rut} onClick={() => pb.datHuong('nap')}>
                {chu.nhanVao}
              </button>
              <button type="button" className={s.nutHuong} aria-pressed={rut} onClick={() => pb.datHuong('rut')}>
                {chu.nhanRa}
              </button>
            </div>
            {/* ⚠ Luôn đứng đó (tắt khi không còn gì để gõ): nút biến mất thì hai nút chiều nở ra giữa hai cú chạm. */}
            <button
              type="button" className={s.chip} aria-pressed={moGo} disabled={tran === 0 && !moGo}
              aria-label={moGo ? CP.goSoDong : CP.goSo}
              onClick={() => { rung(NHIP_RUNG.cham); datGo(moGo ? null : ''); }}
            >
              {moGo ? '✕' : CP.goSo}
            </button>
          </div>
        )}
        {than}
      </div>
    </div>
  );
}
