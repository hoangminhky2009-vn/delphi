/**
 * PFM — MÀN SỔ. **Làm lại theo DEMO ĐÃ CHỐT** (A11.25).
 *
 * ⚠⚠ BẢN TRƯỚC (D275) TÔI DỰNG TỪ VĂN BẢN KẾ HOẠCH §B3 trong khi demo đã chốt nằm sẵn
 * đó — ra một màn khác hẳn: hai ô CHI/THU thay vì một số tổng, có chuyển tháng ‹ ›, dải
 * 30 ô đặt nhầm sang màn SỔ (demo để ở GƯƠNG), và thiếu hẳn thẻ hũ. Đây là bản theo demo.
 *
 * ⚠ Bố cục demo, đúng thứ tự: TỔNG (một số) → HŨ → DANH SÁCH → bàn tiền neo đáy.
 * ⚠ A10 🔒 vẫn nguyên: màn chỉ ĐẾM và TẢ, không thanh ngân sách, không màu phán xét.
 *
 * ⭐⭐⭐ SỬA/XOÁ ĐI QUA ĐÚNG ĐƯỜNG GHI CỦA BÀN TIỀN (`useDuongGhi`, D284). Màn dựng đường
 * ấy MỘT lần rồi đưa xuống cho bàn tiền, nên nút XOÁ ở danh sách và cú chạm-đích ở đáy là
 * cùng một cửa vào kho, cùng một toast hoàn tác. Hai đường ghi là hai đường phải giữ đồng
 * bộ mãi mãi, và đường ít dùng hơn sẽ lặng lẽ trôi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NutChinh, OBento } from '@/components/ui/OBento';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { TamTruot } from '@/components/ui/TamTruot';
import { TamDau } from '@/screens/hub/TamDau';
import { tienGon, chieuCaoCot, tomTatHub } from '@/lib/hub_tai_chinh';
import { soCungNgay } from '@/pfm/bieu_do';
import b from '@/components/pfm/PfmBento.module.css';
import { BanTien, useDuongGhi } from '@/components/pfm/BanTien';
import { DeNghiMau } from '@/components/pfm/DeNghiMau';
import { LoiTuDan } from '@/components/pfm/LoiTuDan';
import { ThanhTienDo, nacCua } from '@/components/pfm/ThanhTienDo';
import {
  KhoProvider, useGhiKho, useHoSo, useHu, useSoTatCa, useSoThang, useTinhTrangKho,
} from '@/pfm/dung_kho';
import { dauTuan } from '@/pfm/huong_tuan';
import { huongMoiTuan, lanLamUuTien } from '@/pfm/huong_hu';
import { cauHuongDangTheo } from '@/components/pfm/cau_huong';
import { useSoChay } from '@/lib/hooks';
import { congSo, laGanChi, laPhanBo, laThu, tongGopVaoHu, type Khoan } from '@/pfm/so';
import {
  laTichLuy, laTieuDung, quyetToan, resetGop, sua as suaHu, tienDo, type Hu, type MaKetQuaHu,
} from '@/pfm/hu';
import { loiDoanHuDangMo, type MaLyDoViThe } from '@/pfm/vi_the';
import { chiChuaChia, laRutHu, tienConLai } from '@/pfm/phan_bo';
import { bayGio, homNay, soNgayTrongThang, thangNay, thangTruocCua } from '@/pfm/thoi_gian';
import { ROUTE_TAI_CHINH_GUONG, ROUTE_TAI_CHINH_HU } from '@/lib/vocab';
import {
  CHU_BENTO as CB, CHU_LOAI_CHI, CHU_MAN_HU, CHU_MAN_SO, CHU_PHAN_BO as CP, CHU_VI_THE, O_CHU_LOAI_CHI,
} from '@/lib/pfm_chu';
// ⚠ MỘT nguồn cho hộp quyết toán C7 — `QuyetToanHop.tsx` (D61; tách khỏi `Hu.tsx` ở D431 để SỔ không tải cả màn HŨ).
import { QuyetToanHop } from './QuyetToanHop';
import s from './So.module.css';

/* ═══ tiện ích thuần ════════════════════════════════════════════════════════ */

/**
 * ⚠ ĐỊNH DẠNG TIỀN TÁCH RIÊNG KHỎI `formatT`. `formatT` là của TOKEN (đơn vị T, tiền
 * trong trò). Đây là ĐỒNG, tiền thật — trộn hai bộ định dạng là mời đúng cú nhầm mà
 * tường lửa T ↔ tiền-thật (A3.5) dựng ra để chặn.
 */
export function dinhDangDong(n: number): string {
  return n.toLocaleString('vi-VN');
}

/** `'2026-09'` → `9`. Dòng phụ của demo viết "tháng 9", không viết "THÁNG 9 · 2026". */
export function soThang(thang: string): number {
  return Number(thang.slice(5, 7));
}

/** Tên một mốc ngày: HÔM NAY · HÔM QUA · "T2 · 28/09" (thứ trong tuần theo lịch người Việt — thứ Hai là T2). */
export function tenNgay(ngay: string, nay: string): string {
  if (ngay === nay) return CHU_MAN_SO.homNayNhan;
  const d = new Date(`${nay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  if (ngay === d.toISOString().slice(0, 10)) return CHU_MAN_SO.homQua;
  const thu = new Date(`${ngay}T00:00:00Z`).getUTCDay();
  return `${thu === 0 ? 'CN' : `T${thu + 1}`} · ${ngay.slice(8, 10)}/${ngay.slice(5, 7)}`;
}

/** Gom theo ngày, MỚI NHẤT TRƯỚC — đúng thứ người ta muốn thấy khi mở sổ. */
export function gomTheoNgay(ds: readonly Khoan[]): { ngay: string; khoan: Khoan[] }[] {
  const m = new Map<string, Khoan[]>();
  for (const k of ds) (m.get(k.ngay) ?? m.set(k.ngay, []).get(k.ngay)!).push(k);
  return [...m.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ngay, khoan]) => ({ ngay, khoan }));
}

/**
 * ⭐⭐ BỎ DÒNG ĐANG SỬA RA KHỎI MỌI PHÉP CỘNG — hàm thuần, dùng cho cả sổ tháng lẫn cả sổ.
 *
 * ⚠ Vì sao phải bỏ: cú sửa chưa chốt thì bản ghi CŨ vẫn nằm nguyên trong kho (ta ghi đè
 * chứ không xoá trước — xem `useDuongGhi`). Để nó trong danh sách thì màn vừa hiện con số
 * cũ vừa cầm con số ấy ở khay: **một khoản đếm hai lần**, đúng thứ demo tránh bằng cách
 * gỡ dòng ra khỏi danh sách ngay lúc bấm SỬA LẠI.
 */
export function boDongDangSua(ds: readonly Khoan[], idSua: string | null): readonly Khoan[] {
  return idSua === null ? ds : ds.filter((k) => k.id !== idSua);
}

/**
 * ⭐⭐ HŨ NÀY ĐANG **ĐẦY VÀ CÒN CHỐT ĐƯỢC** — hàm thuần, và hai vế đều bắt buộc.
 *
 * ⚠ `tienDo` trả `null` khi CHƯA ĐẶT MỨC, và `null` ≠ 0 ≠ đầy: hũ chưa có mức thì không
 * có "đầy" nào để nói tới. Nên phải hỏi `p !== null` trước, không được ngã về `?? 0`.
 * ⚠⚠ VÀ PHẢI CÒN CHUYỂN ĐƯỢC SANG `xong`. Hũ đã `xong` là điểm cuối (`CHUYEN_DUOC` ở
 * `hu.ts` cho nó một danh sách RỖNG) — bày lại ba lựa chọn trên một hũ đã chốt là mời
 * người dùng bấm một cú mà `quyetToan()` sẽ ném lỗi, và tệ hơn: nó gợi rằng chốt hũ hai
 * lần là chuyện làm được, trong khi đúng cái đó sẽ làm "tỷ lệ hoàn thành" đếm một hũ
 * nhiều lần.
 */
export function huDaDay(h: Hu, daGop: number): boolean {
  const p = tienDo(h, daGop);
  return p !== null && p >= 1
    && (h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung');
}

/* ═══ màn ═══════════════════════════════════════════════════════════════════ */

export default function So(): React.ReactElement {
  return (
    <KhoProvider>
      <RuotSo />
    </KhoProvider>
  );
}

/** ⚠ Xuất ra cho bài test — bản mặc định tự mở IndexedDB thật; test bơm kho của mình. */
export function RuotSo(): React.ReactElement {
  // ⚠ Đọc đồng hồ MỘT lần lúc dựng state. Demo không có chuyển tháng, nên đây là tháng
  //   duy nhất màn hiển thị — muốn xem tháng khác là một thay đổi phải chốt ở DEMO trước.
  const [thang] = useState(() => thangNay());
  const [ngay] = useState(() => homNay());
  const { data: so, dangTai } = useSoThang(thang);
  const { data: hu, dangTai: dangTaiHu } = useHu();
  /*
   * ⚠ CẢ SỔ, không phải sổ của tháng: hũ cộng dồn xuyên tháng. Đọc một tháng thì tiến độ
   * hũ tụt về gần 0 vào ngày mùng 1, im lặng.
   */
  const { data: tatCa, dangTai: dangTaiTatCa } = useSoTatCa();
  const { ben, loiMo, dangMo } = useTinhTrangKho();
  /* Id của dòng VỪA GHI — chỉ để nó rơi xuống nảy một lần (`.moi`), không mang nghĩa gì
     khác. Đặt ở đây vì `BanTien` báo lên còn `DanhSach` mới là chỗ vẽ. */
  const [moiGhi, datMoiGhi] = useState<string | null>(null);

  /* MỘT đường ghi cho cả màn — bàn tiền dùng nó, và hai nút SỬA/XOÁ dưới đây cũng vậy. */
  const duong = useDuongGhi(datMoiGhi);
  const idSua = duong.dangSua?.id ?? null;

  /*
   * D424 — khoản GÁN chi tiêu (màn HŨ) không phải tiền: không có chỗ trong danh sách sổ. `soHien` vẫn giữ nó cho phép
   * tính (mọi phép tính tiền đã tự bỏ nó ra — `congSo` · `tienConLai`); chỉ danh sách lọc.
   */
  const soHien = useMemo(() => boDongDangSua(so, idSua), [so, idSua]);
  const tatCaHien = useMemo(() => boDongDangSua(tatCa, idSua), [tatCa, idSua]);
  const tong = useMemo(() => congSo(soHien), [soHien]);
  const { data: hoSo } = useHoSo();
  const cauHuong = useMemo(() => {
    const lc = huongMoiTuan(hoSo.huong ?? [], dauTuan(ngay));
    return lc === null ? null : cauHuongDangTheo(lc, hu, lanLamUuTien(lc, tatCa, ngay));
  }, [hoSo, hu, tatCa, ngay]);
  /*
   * ⭐ D453 — SỐ TO LÀ HÔM NAY. Ghi một khoản là thấy chính con số này nhảy (đếm lên theo nhịp máy — `useSoChay`); tổng
   *   tháng lùi xuống dòng phụ. Trước đó số to là tổng tháng: sáu triệu đứng yên, cú ghi 40k không để lại dấu gì trên mắt.
   * ⚠ Cùng phép cộng `congSo` (bỏ khoản chuyển vào hũ — `laChiTieu`), chỉ lọc ngày: một nguồn cho "đã chi".
   */
  const chiHomNay = useMemo(() => congSo(soHien.filter((k) => k.ngay === ngay)).chi, [soHien, ngay]);
  const soHomNay = useSoChay(chiHomNay);
  /* Tuần này đang theo hướng nào (tấm HƯỚNG ở GƯƠNG — mô hình demo bản 6): khe bàn giao đọc lại ĐÚNG câu của lựa chọn ấy, kèm "làm đúng k/n lần". */
  const nhom = useMemo(() => gomTheoNgay(soHien.filter((k) => !laGanChi(k))), [soHien]);
  /*
   * D421 — hũ đầy ở SỔ là hũ GOM TỚI MỨC (đầy ⇒ chốt · gia hạn · reset): chỉ hũ TÍCH LŨY. Hũ tiêu dùng không đầy, không chốt —
   * số của nó (đã tiêu tháng này) nằm ở màn HŨ.
   * ⚠ Bento (SPEC `pfm-tang-khong-gian`): mặt SỔ KHÔNG còn hàng thẻ hũ (hũ ở tab HŨ) nên không cắt `HU_TREN_SO` nữa — mọi hũ tích lũy
   *   được xét "đầy chưa", và hũ đầy hiện ở chip "✓ N hũ đầy" của ô TỐI NAY; ba lựa chọn nằm ở lớp trượt của ô ấy.
   */
  const huHien = useMemo(() => hu.filter(laTichLuy), [hu]);
  /* D420 — tiền còn lại chưa vào hũ nào (ví = Σ THU − Σ CHI, `pfm/phan_bo.ts`): lối sang khay chia ở màn HŨ. */
  const viCon = useMemo(() => tienConLai(tatCaHien), [tatCaHien]);
  /* D424 — tiền chi tháng này chưa chia vào hũ tiêu dùng (cùng phép tính với khay ở màn HŨ — một nguồn: `chiChuaChia`). */
  const chiCon = useMemo(() => chiChuaChia(tatCaHien, ngay.slice(0, 7)), [tatCaHien, ngay]);
  const coHuTichChay = useMemo(() => hu.some((h) => laTichLuy(h) && h.trangThai === 'dang_chay'), [hu]);
  const coHuTieuChay = useMemo(() => hu.some((h) => laTieuDung(h) && h.trangThai === 'dang_chay'), [hu]);
  const phanVi = viCon > 0 && coHuTichChay;
  const phanChi = chiCon > 0 && coHuTieuChay;
  const huTheoId = useMemo(() => new Map(hu.map((h) => [h.id, h])), [hu]);

  /* ── HŨ ĐẦY → ba lựa chọn → quyết toán C7 (mảnh nợ ⓐ, founder chốt 06/09) ── */
  const ghiKho = useGhiKho();
  /** Hũ đang mở ba lựa chọn. */
  const [moHuId, datMoHuId] = useState<string | null>(null);
  /** Hũ đang mở hộp quyết toán C7. */
  const [quyetToanId, datQuyetToanId] = useState<string | null>(null);
  /** Hũ VỪA đầy — chỉ để nảy một lần. */
  const [vuaDay, datVuaDay] = useState<string | null>(null);

  const theHu = useMemo(
    () => huHien.map((h) => {
      // ⚠ Đưa MỐC vào: sau RESET, "đã góp" là tổng khoản ghi sau `mocGop` (so.ts).
      const daGop = tongGopVaoHu(tatCaHien, h.id, h.mocGop);
      return { h, daGop, day: huDaDay(h, daGop) };
    }),
    [huHien, tatCaHien],
  );

  /*
   * ⚠⚠ NẢY CHỈ Ở KHOẢNH KHẮC **VỪA** ĐẦY — không nảy lại mỗi lượt vẽ, và cũng không nảy
   * khi chỉ MỞ LẠI màn với một hũ vốn đã đầy từ hôm qua. Một cú ăn mừng phát lại mỗi lần
   * quay về màn SỔ là một cú ăn mừng không còn nghĩa gì (và nó nảy đúng lúc người ta đang
   * đọc danh sách).
   * ⚠ `null` ở lượt ĐẦU nghĩa là "chưa biết gì" — lượt ấy chỉ GHI NHẬN, không nảy. Nếu
   *   khởi tạo bằng `new Set()` thì mọi hũ đang đầy sẵn đều bị tính là vừa đầy.
   * ⚠ Rời khỏi trạng thái đầy thì thả cờ ra, để lần đầy sau nảy lại được.
   */
  const daBietDay = useRef<Set<string> | null>(null);
  /*
   * ⚠⚠ PHẢI ĐỢI CẢ HAI TRUY VẤN VỀ. Hũ và sổ về ở hai lượt vẽ khác nhau, nên trong khoảnh
   * khắc giữa chúng một hũ đã đầy từ hôm qua trông như "chưa đầy" (chưa có sổ ⇒ đã góp =
   * 0) rồi "vừa đầy" — và nó nảy, mỗi lần mở màn. Đúng thứ chú thích trên vừa cấm, và một
   * `Set` rỗng làm mốc thì bẫy này KHÔNG lộ ra, vì mọi hũ đầy sẵn đều là "mới" so với rỗng.
   * ⚠ Đây cũng là P7 ở tầng UI: chưa đủ dữ liệu thì **chưa nói gì**, không nói "chưa đầy".
   */
  const dangTaiHuSo = dangTaiHu || dangTaiTatCa;
  useEffect(() => {
    if (dangTaiHuSo) return;
    const truoc = daBietDay.current;
    const gio = new Set(theHu.filter((t) => t.day).map((t) => t.h.id));
    daBietDay.current = gio;
    const moi = truoc === null ? undefined : [...gio].find((id) => !truoc.has(id));
    datVuaDay((cu) => {
      if (moi !== undefined) return moi;
      return cu !== null && gio.has(cu) ? cu : null;
    });
  }, [theHu, dangTaiHuSo]);

  /*
   * ⚠ SUY RA, KHÔNG CẤT. Hũ vừa GIA HẠN thì hết đầy ⇒ `moHu` thành `null` ⇒ ba lựa chọn tự
   * đóng. Cất một cờ "đang mở" riêng là dựng bản thứ hai của cùng sự thật, và nó sẽ kẹt mở
   * trên một thẻ không còn lựa chọn nào.
   */
  const moHu = theHu.find((t) => t.h.id === moHuId && t.day) ?? null;
  const quyetToanHu = quyetToanId === null
    ? null
    : theHu.find((t) => t.h.id === quyetToanId && t.day)?.h ?? null;

  /**
   * ⭐⭐⭐ CHỐT HŨ — nấc do NGƯỜI DÙNG bấm, app không suy từ phần trăm.
   *
   * ⚠⚠ Demo tự điền `ketQua='du'` vì "hũ đang ở đúng 100%, dữ liệu đã trả lời rồi". Founder
   * bác 06/09 (phương án A): app biết họ góp bao nhiêu QUA APP, không biết họ có gom thêm
   * ở chỗ khác không. Suy nấc từ phần trăm là **app bịa một outcome** rồi đem bán nó như
   * câu trả lời của người dùng — mà `kq_dat_muc_tieu` là lớp outcome, đi thẳng vào dataset
   * và không dựng lại được ở kỳ sau (P7/D62).
   */
  async function chotHu(h: Hu, ma: MaKetQuaHu, lyDo?: MaLyDoViThe): Promise<void> {
    const luc = bayGio();
    const moi = quyetToan(h, 'xong', ma, luc, lyDo);
    await ghiKho(
      ['hu'],
      (kho) => kho.ghi('hu', { id: h.id, thang: thangNay(), suaLuc: luc, d: moi }),
    );
    datQuyetToanId(null);
    datMoHuId(null);
  }

  /**
   * ⭐ GIA HẠN — XOÁ mức cũ, hết. Hũ về "chưa đặt mức", mức mới do user đặt ở màn HŨ.
   *
   * ⚠⚠ APP KHÔNG TỰ NÂNG MỨC, và đây không phải chuyện tiện tay. Đề xuất một con số tiền
   * cho cá nhân là lúc app thôi MÔ TẢ và bắt đầu KÊ ĐƠN (A10 🔒 · P3 🔒) — kể cả khi con
   * số ấy "hợp lý" (mức cũ ×2, hay bằng đúng số đã góp).
   * ⚠ `sua(hu,{muc:null})` cố ý KHÔNG ghi dấu hướng nào: bỏ mức không phải là hạ mức, và
   *   gộp hai cái làm `hv_sua_muc_tieu` đọc ra một người hay hạ chuẩn trong khi họ đang dọn
   *   hũ (`hu.ts` viết sẵn lý do này).
   */
  async function giaHan(h: Hu): Promise<void> {
    const luc = bayGio();
    const moi = suaHu(h, { muc: null }, luc);
    await ghiKho(
      ['hu'],
      (kho) => kho.ghi('hu', { id: h.id, thang: thangNay(), suaLuc: luc, d: moi }),
    );
    datMoHuId(null);
  }

  /**
   * ⭐ RESET — về 0 bằng MỐC, mức giữ nguyên (founder chốt phương án A, D292 §Còn nợ).
   *
   * ⚠⚠ KHÔNG cất `daGop = 0` và KHÔNG cắt `huId` của khoản đã góp. `hu.ts` cấm cất tổng vì
   * bản sao thứ hai của phép cộng SẼ trôi; còn cắt `huId` là app tự sửa sổ của người dùng —
   * xoá đi sợi dây họ đã tự nối. Dời mốc thì cả hai còn nguyên: khoản cũ vẫn trong danh sách
   * ngay dưới, vẫn nối hũ, chỉ thôi được đếm (`tongGopVaoHu` nhận `mocGop`).
   * ⚠ Thẻ hết đầy ⇒ `moHu` tự thành `null` ⇒ ba lựa chọn tự đóng — cùng đường với GIA HẠN.
   */
  async function resetHu(h: Hu): Promise<void> {
    const luc = bayGio();
    const moi = resetGop(h, luc);
    await ghiKho(
      ['hu'],
      (kho) => kho.ghi('hu', { id: h.id, thang: thangNay(), suaLuc: luc, d: moi }),
    );
    datMoHuId(null);
  }

  /* ── MẶT BENTO (SPEC `pfm-tang-khong-gian`): số liệu cho ba ô + khe gợi ý + bàn tiền; mọi thứ khác ở lớp trượt ── */
  const navigate = useNavigate();
  const tt = useMemo(() => tomTatHub(tatCaHien, hu, ngay), [tatCaHien, hu, ngay]);
  const dangTaiMat = dangTai || dangTaiTatCa || dangTaiHu;
  const coGhiNgay = useMemo(() => new Set(soHien.map((k) => k.ngay)), [soHien]);
  const ngayCoGhi = coGhiNgay.size;
  const ngayDaQua = Number(ngay.slice(8, 10));
  const gonHomNay = tienGon(soHomNay);
  const khoanGanDay = useMemo(
    () => nhom.flatMap((n) => n.khoan).sort((a, b) => (a.taoLuc < b.taoLuc ? 1 : -1)).slice(0, SO_DONG_NHO),
    [nhom],
  );
  const soHuDay = theHu.filter((t) => t.day).length;
  const nutToiNay = phanVi ? viCon : phanChi ? chiCon : null;
  const [tam, datTam] = useState<TamSo>('ds');
  const [moTam, datMoTam] = useState(false);
  const mo = (t: TamSo): void => { datTam(t); datMoTam(true); };
  const dong = useCallback(() => datMoTam(false), []);
  const maxCot = Math.max(...tt.chi7.map((n) => n.chi), 1);

  return (
    <div className={b.trang} data-testid="so-bento">
      <div className={b.soTren}>
        <OBento
          dau="so-hom-nay" className={`${b.vao} ${b.oHomNay}`} style={sole(0)}
          nhan={`${CHU_MAN_SO.homNayNhan}: ${dinhDangDong(soHomNay)}${CHU_MAN_SO.hauDong}`} onChon={() => mo('ds')}
        >
          <span className={b.nhan}><span className={b.ten}>{CB.soChiHomNay}</span><span className={b.mui} aria-hidden="true">›</span></span>
          <span className={`${b.soTo} ${dangTaiMat ? b.cho : ''}`} data-testid="so-hom-nay" data-day-du={dinhDangDong(soHomNay)}>
            {dangTaiMat ? '—' : <>{gonHomNay.so}<small>{gonHomNay.don}</small></>}
          </span>
          <span className={b.cot7} aria-hidden="true">
            {tt.chi7.map((n, i) => (
              <i
                key={n.ngay} className={`${b.mocDoc} ${i === 6 ? b.nay : n.chi === 0 ? b.trong : ''}`}
                style={{ height: `${chieuCaoCot(n.chi, maxCot)}%`, '--j': i } as React.CSSProperties}
              />
            ))}
          </span>
          <span className={`${b.duoi} ${b.mot}`}>{CB.soBayNgay}</span>
          <span className={b.dsNho}>
            {khoanGanDay.map((k) => (
              <span key={k.id}>
                <em>{tenKhoanGon(k, k.huId !== null ? huTheoId.get(k.huId)?.ten ?? null : null)}</em>
                {`${laThu(k) ? '+' : laRutHu(k) ? '←' : laPhanBo(k) ? '→' : '−'}${tienGonChu(k.soTien)}`}
              </span>
            ))}
            {!dangTaiMat && khoanGanDay.length === 0 && <span><em>{CB.soChuaGhi}</em></span>}
          </span>
        </OBento>
        <div className={b.cotPhai}>
          <OBento
            dau="so-thang" className={`${b.vao} ${b.oHang}`} style={sole(1)}
            nhan={`${CB.soThangPre}${soThang(thang)}`} onChon={() => mo('thang')}
          >
            <span className={b.nhan}><span className={b.ten}>{`${CB.soThangPre}${soThang(thang)}`}</span><span className={b.mui} aria-hidden="true">›</span></span>
            <span className={`${b.duoi} ${b.mot}`}>
              {dangTaiMat ? CB.dangTai : (
                <>
                  {CB.soChi} <b className={b.dam} data-testid="so-thang-chi" data-day-du={dinhDangDong(tong.chi)}>{tienGonChu(tong.chi)}</b> · {CB.soThu} <b className={b.dam} data-testid="so-thang-thu" data-day-du={dinhDangDong(tong.thu)}>{tienGonChu(tong.thu)}</b>
                </>
              )}
            </span>
            <span className={b.thanh} aria-hidden="true">
              <i className={b.mocNgang} style={{ width: `${ngayDaQua > 0 ? Math.min(100, Math.round((ngayCoGhi / ngayDaQua) * 100)) : 0}%` }} />
            </span>
            <span className={b.lichNho} aria-hidden="true">
              {Array.from({ length: soNgayTrongThang(thang) }, (_, i) => {
                const nd = `${thang}-${String(i + 1).padStart(2, '0')}`;
                return <i key={nd} className={`${coGhiNgay.has(nd) ? b.on : ''} ${nd === ngay ? b.homNay : ''}`} />;
              })}
            </span>
            <span className={`${b.duoi} ${b.mot}`}>
              {dangTaiMat ? ' ' : `${CB.soGhiPre}${ngayCoGhi} / ${ngayDaQua}${CB.soNgayHau}`}
            </span>
          </OBento>
          <OBento
            dau="so-toi-nay" className={`${b.vao} ${b.oHang} ${b.oVang}`} style={sole(2)}
            nhan={CB.soToiNay} onChon={() => mo('toi')}
          >
            <span className={b.nhan}>
              <span className={b.ten}>{CB.soToiNay}</span>
              {soHuDay > 0 && <span className={b.chipDay} data-testid="so-hu-day" title={`${soHuDay}`}>{CB.soHuDay}</span>}
              <span className={b.mui} aria-hidden="true">›</span>
            </span>
            <span className={`${b.soTo} ${b.soVua} ${b.vang} ${nutToiNay === null ? b.cho : ''}`} data-testid="so-toi-nay">
              {nutToiNay === null ? '—' : <>{tienGon(nutToiNay).so}<small>{tienGon(nutToiNay).don}</small></>}
            </span>
            <span className={b.iconGiua} aria-hidden="true"><PixelIcon name="coin" size={32} /></span>
            <span className={`${b.duoi} ${b.mot}`}>
              {dangTaiMat ? ' ' : phanVi || phanChi
                ? (phanVi ? CB.soChuaChia : CB.soChiChuaChia)
                : hu.some((h) => h.trangThai === 'dang_chay') ? CB.soDaChiaHet : CB.soChuaCoHu}
            </span>
          </OBento>
        </div>
      </div>

      {/*
        KHE GỢI Ý — MỘT hàng cao cố định (44 px). Nền: lối sang HƯỚNG (GƯƠNG). Phủ lên khi có: cảnh báo kho tạm (tiền không bền!) ·
        đề nghị lưu mẫu · lời tự dặn. Chúng TỰ IM khi không có việc, nên không khối nào nhảy — và mọi khối cũ của SỔ vẫn tới được (D453).
      */}
      <div className={b.khe}>
        <OBento
          dau="so-huong" className={`${b.vao} ${b.oHuong}`} style={sole(3)}
          nhan={CHU_MAN_SO.huongTuanPre.trim()} onChon={() => navigate(ROUTE_TAI_CHINH_GUONG)}
        >
          <span className={b.nhan}>
            <span className={b.ten}>{CB.soHuongTuan}</span>
            <span className={b.mui} aria-hidden="true">›</span>
          </span>
          <span className={`${b.duoi} ${b.mot}`} data-testid="so-huong-cau">{cauHuong ?? CB.soHuongChua}</span>
        </OBento>
        <div className={b.pho}>
          <DeNghiMau gon />
          <LoiTuDan gon />
          {!dangMo && !ben && <DaiCanhBaoKho loiMo={loiMo} />}
        </div>
      </div>

      <div className={b.banTien}>
        <BanTien duong={duong} khongThu />
      </div>

      <TamTruot
        mo={moTam} onDong={dong} nhan={tam === 'ds' ? CB.soDsTen : tam === 'thang' ? `${CB.soThangPre}${soThang(thang)}` : CB.soToiNay}
        dau="so" cao="lon"
        chan={tam === 'toi' ? (
          <NutChinh dau="so-di-hu" onChon={() => { dong(); navigate(`${ROUTE_TAI_CHINH_HU}?chia=1`); }}>{CB.soMoHu}</NutChinh>
        ) : undefined}
      >
        {tam === 'ds' && (
          <>
            <TamDau icon={<PixelIcon name="news" size={32} />} ten={`${CB.soDsTen} ${soThang(thang)}`} tag={CB.soDsTag} />
            {dangTai
              ? <p className={s.vidu}>{CHU_MAN_SO.dangMoSo}</p>
              : nhom.length === 0
                ? <p className={s.vidu}>{CHU_MAN_SO.soTrong}</p>
                : (
                  <DanhSach
                    nhom={nhom}
                    homNay={ngay}
                    huTheoId={huTheoId}
                    moiGhi={moiGhi}
                    sua={(k) => { dong(); duong.batDauSua(k); }}
                    xoa={(k) => { dong(); void duong.xoa(k); }}
                  />
                )}
          </>
        )}
        {tam === 'thang' && (
          <TamThang thang={thang} ngay={ngay} tong={tong} ngayCoGhi={ngayCoGhi} ngayDaQua={ngayDaQua} tatCa={tatCaHien} />
        )}
        {tam === 'toi' && (
          <>
            <TamDau icon={<PixelIcon name="coin" size={32} />} ten={CB.soToiNay} tag={CB.soToiTag} />
            <div className={b.dongL}>
              <span>{CB.soToiViPre}</span><b className={b.vang}>{`${dinhDangDong(viCon)}${CHU_MAN_SO.hauDong}`}</b>
            </div>
            {phanChi && (
              <div className={b.dongL}>
                <span>{CB.soToiChiPre}</span><b className={b.vang}>{`${dinhDangDong(chiCon)}${CHU_MAN_SO.hauDong}`}</b>
              </div>
            )}
            {theHu.filter((t) => t.day).map(({ h, daGop, day }) => (
              <TheHu
                key={h.id} h={h} daGop={daGop} day={day} nay={vuaDay === h.id}
                moRa={moHu?.h.id === h.id} onCham={() => datMoHuId((cu) => (cu === h.id ? null : h.id))}
              />
            ))}
            {/* BA LỰA CHỌN của hũ đầy ngay dưới thẻ hũ vừa chạm; hộp quyết toán THAY CHỖ ba lựa chọn (cùng nếp bàn tiền). */}
            {moHu !== null && quyetToanHu === null && (
              <>
                <div className={s.huChon}>
                  <button type="button" className={s.chinh} onClick={() => datQuyetToanId(moHu.h.id)}>{CHU_MAN_SO.huChot}</button>
                  <button type="button" onClick={() => void giaHan(moHu.h)}>{CHU_MAN_SO.huGiaHan}</button>
                  <button type="button" onClick={() => void resetHu(moHu.h)}>{CHU_MAN_SO.huReset}</button>
                </div>
                <p className={s.huChonPhu}>{CHU_MAN_SO.huChonGiai}</p>
                {loiDoanHuDangMo(moHu.h, thang) !== null && (
                  <p className={s.huChonPhu} data-testid="canh-loi-doan">{CHU_VI_THE.canhGiaHan}</p>
                )}
              </>
            )}
            {quyetToanHu !== null && (
              <QuyetToanHop
                hu={quyetToanHu}
                dich="xong"
                loiDoan={loiDoanHuDangMo(quyetToanHu, thang)}
                onChon={(ma, lyDo) => void chotHu(quyetToanHu, ma, lyDo)}
              />
            )}
          </>
        )}
      </TamTruot>
    </div>
  );
}

/** Số dòng khoản gần đây trên ô CHI HÔM NAY (ô thấp thì CSS ẩn bớt — xem `.dsNho`). */
const SO_DONG_NHO = 5;

type TamSo = 'ds' | 'thang' | 'toi';

/** `{ '--i': n }` — thứ tự vào so le của ô (SPEC mục 5: `ndVaoLen` so le). */
function sole(i: number): React.CSSProperties {
  return { '--i': i } as React.CSSProperties;
}

/** Tiền gọn thành MỘT chuỗi: `125k` · `2,4tr` · `850đ`. */
function tienGonChu(n: number): string {
  const g = tienGon(n);
  return g.don === 'đ' ? `${g.so}đ` : `${g.so}${g.don}`;
}

/**
 * Tên một khoản cho dòng gọn — CÙNG logic với `Dong` (một nguồn: hàm này là chỗ tính tên, `Dong` gọi lại).
 * ⚠ Hũ không còn ⇒ không bịa tên hũ (D420).
 */
export function tenKhoanGon(k: Khoan, tenHu: string | null): string {
  const chuyen = laPhanBo(k);
  const rut = laRutHu(k);
  const coGhiChu = k.ghiChu !== undefined && k.ghiChu !== '';
  const goc = coGhiChu ? k.ghiChu!
    : k.nhan === null ? (k.chieu === 'thu' ? CP.tenThu : CP.tenChi) : CHU_LOAI_CHI[k.nhan];
  return chuyen
    ? (tenHu !== null ? `${rut ? CP.rutHuPre : CP.vaoHuPre}${tenHu}${k.phanBo === 'tu_dong' ? CP.tuChia : ''}` : goc)
    : tenHu !== null && !coGhiChu ? tenHu : goc;
}

/** Ruột lớp THÁNG: tổng chi · tổng thu · so CÙNG NGÀY tháng trước (một phép — `soCungNgay`) · số ngày có ghi. */
function TamThang(
  { thang, ngay, tong, ngayCoGhi, ngayDaQua, tatCa }: {
    thang: string; ngay: string; tong: { chi: number; thu: number }; ngayCoGhi: number; ngayDaQua: number; tatCa: readonly Khoan[];
  },
): React.ReactElement {
  const cung = useMemo(() => soCungNgay(tatCa, thang, Number(ngay.slice(8, 10))), [tatCa, thang, ngay]);
  const lech = cung.nay - cung.truoc;
  return (
    <>
      <TamDau icon={<PixelIcon name="chart" size={32} />} ten={`${CB.soThangPre}${soThang(thang)}`} tag={`${CB.soGhiPre}${ngayCoGhi} / ${ngayDaQua}${CB.soNgayHau}`} />
      <div className={b.dongL}><span>{CB.soTongChi}</span><b>{`${dinhDangDong(tong.chi)}${CHU_MAN_SO.hauDong}`}</b></div>
      <div className={b.dongL}><span>{CB.soTongThu}</span><b>{`${dinhDangDong(tong.thu)}${CHU_MAN_SO.hauDong}`}</b></div>
      {/* A10: chỉ TẢ chênh lệch, không màu phán xét. Tháng trước chưa có khoản nào ⇒ không có gì để so (D62), không viết "0". */}
      <div className={b.dongL}>
        <span>{`${CB.soCungNgayPre}${soThang(thangTruocCua(thang))}`}</span>
        <b>
          {cung.truoc === 0 ? CB.chuaDuDeNoi : lech === 0 ? CB.soBangNhau : `${lech < 0 ? CB.soItHon : CB.soNhieuHon} ${dinhDangDong(Math.abs(lech))}${CHU_MAN_SO.hauDong}`}
        </b>
      </div>
    </>
  );
}

/**
 * ⚠⚠ DẢI NÀY LÀ MỘT LỜI HỨA ĐƯỢC GIỮ. `kho.ts` bắt: *"Rơi về bản này là MẤT DỮ LIỆU KHI
 * ĐÓNG APP, nên người gọi phải được BÁO, không được im lặng nuốt."* Đây là chỗ báo.
 */
function DaiCanhBaoKho({ loiMo }: { loiMo: string | null }): React.ReactElement {
  return (
    <div className={s.canhBao} role="alert">
      <strong>{CHU_MAN_SO.khoTamTieu}</strong>{' '}
      {CHU_MAN_SO.khoTamThan}
      {loiMo !== null && <span className={s.viSao}> ({loiMo})</span>}
    </div>
  );
}

/**
 * Thẻ hũ trên màn SỔ — hình của demo: `i` (tên + %) · `b` (số đã góp) · thanh `.tt`.
 *
 * ⚠ `tienDo` trả `null` khi hũ CHƯA ĐẶT MỨC, và `null` không phải 0: "chưa đặt mức" là
 * một trạng thái thật, còn 0% là một phát biểu rằng đã có mức và chưa góp được gì. Demo
 * hiện `—` cho ca ấy.
 *
 * ⚠⚠ THẺ ĐẦY LÀ `<button>`, THẺ THƯỜNG LÀ `<div>` — cố ý lệch hình dạng DOM của demo mà
 * KHÔNG lệch hình. Demo là JS thuần nên nó nghe `click` trên cả hàng rồi bỏ qua thẻ chưa
 * đầy; hệ quả là thẻ đầy vẫn chỉ là một `<div>`, tức bàn phím và trình đọc màn hình
 * **không tới được** đường điều khiển duy nhất dẫn tới cú chốt hũ. Đây đúng ca đã có
 * tiền lệ trong repo (lưới đích của bàn tiền dựng-có-điều-kiện thay vì `display:none`):
 * cùng một luật đã duyệt, nói bằng thứ ngôn ngữ đúng hơn của nền tảng.
 */
function TheHu(
  { h, daGop, day, nay, moRa, onCham }: {
    h: Hu; daGop: number; day: boolean; nay: boolean; moRa: boolean; onCham: () => void;
  },
): React.ReactElement {
  const p = tienDo(h, daGop);
  const pct = p === null ? 0 : Math.round(p * 100);
  const than = (
    <>
      <i>
        {h.ten.toUpperCase()}
        <em style={{ '--nac': `var(${nacCua(pct).tok})` } as React.CSSProperties}>
          {p === null ? CHU_MAN_SO.oChuaNhan : `${pct}%`}
        </em>
      </i>
      <b>{dinhDangDong(daGop)}</b>
      <ThanhTienDo pct={pct} nhan={`${h.ten}: ${p === null ? 'chưa đặt mức' : `${pct}%`}`} />
      {/* ⚠ Chữ dùng chung `CHU_MAN_HU.huDaDay` với màn HŨ — không chép câu thứ hai (D61). */}
      <span className={s.nhanDay}>{`✓ ${CHU_MAN_HU.huDaDay}`}</span>
    </>
  );

  if (!day) return <div className={s.hu}>{than}</div>;

  return (
    <button
      type="button"
      className={`${s.hu} ${s.huDay} ${nay ? s.nay : ''}`}
      aria-expanded={moRa}
      onClick={onCham}
    >
      {/* Quầng thở là một VẬT nằm dưới nội dung (`.hu > *` nâng nội dung lên z-index 1). */}
      <span className={s.quang} aria-hidden="true" />
      {than}
    </button>
  );
}

function DanhSach(
  { nhom, huTheoId, moiGhi, sua, xoa, homNay }: {
    nhom: { ngay: string; khoan: Khoan[] }[];
    /** Ngày của màn (đọc đồng hồ MỘT lần lúc dựng) — cho tên mốc HÔM NAY / HÔM QUA. */
    homNay: string;
    /** Hũ theo id — dòng nối hũ nói nó nằm ở hũ nào (D410), và hũ LOẠI GÌ (D421: phiếu chi ≠ góp). */
    huTheoId: ReadonlyMap<string, Hu>;
    moiGhi: string | null;
    sua: (k: Khoan) => void;
    xoa: (k: Khoan) => void;
  },
): React.ReactElement {
  /*
   * ⚠ MỘT dòng mở tại một lúc. Demo: chạm dòng ⇒ nở ô SỬA/XOÁ ngay dưới nó; chạm dòng
   * khác ⇒ đóng cái cũ. Mở nhiều cái cùng lúc là danh sách nhảy chỗ dưới ngón tay.
   */
  const [mo, datMo] = useState<string | null>(null);
  return (
    <div className={s.ds}>
      {nhom.flatMap((n) => [
        /*
         * ⭐ D453 — MỐC NGÀY: tên ngày · số khoản · tổng CHI của ngày. Một tháng là ~120 dòng; không mốc thì mắt không
         *   biết mình đang ở ngày nào. Tổng ngày đi qua `congSo` (bỏ khoản chuyển vào hũ) — cùng phép với số HÔM NAY.
         */
        <div key={`ngay-${n.ngay}`} className={s.mocNgay} data-testid="moc-ngay">
          <span className={s.tenNgay}>{tenNgay(n.ngay, homNay)}</span>
          <span className={s.demNgay}>{`${n.khoan.length}${CHU_MAN_SO.khoanHau}`}</span>
          {/* Mốc HÔM NAY không in lại tổng — con số ấy đã là số TO đầu màn (mỗi con số một chỗ). */}
          {n.ngay !== homNay && <b className={s.tongNgay}>{dinhDangDong(congSo(n.khoan).chi)}</b>}
        </div>,
        ...n.khoan.map((k) => (
        <Dong
          key={k.id}
          k={k}
          hu={k.huId !== null ? huTheoId.get(k.huId) ?? null : null}
          moi={k.id === moiGhi}
          mo={mo === k.id}
          chon={() => datMo(mo === k.id ? null : k.id)}
          // ⚠ Đóng ô nở SAU khi bấm: dòng sắp biến khỏi danh sách (đang sửa) hoặc thành
          //   bia mộ (xoá), để `mo` trỏ vào một id không còn ai vẽ là một cái bẫy im lặng.
          sua={() => { datMo(null); sua(k); }}
          xoa={() => { datMo(null); xoa(k); }}
        />
        )),
      ])}
      <p className={s.vidu}>{CHU_MAN_SO.viDuSuaXoa}</p>
    </div>
  );
}

function Dong(
  { k, hu, mo, moi, chon, sua, xoa }: {
    k: Khoan; hu: Hu | null; mo: boolean; moi: boolean;
    chon: () => void; sua: () => void; xoa: () => void;
  },
): React.ReactElement {
  /*
   * ⚠ NHÃN RỖNG LÀ MỘT TRẠNG THÁI THẬT: `nhan: null` nghĩa là "chưa phân loại được", và
   * ép nó thành "Khác" là biến một ô trống thành một câu trả lời (cùng luật với `ctx_*`
   * ở D267). Demo dùng ô chữ ngắn trong `.o`.
   * ⭐ D420 — dòng ghi nhanh (không nhãn) là một khoản CHI/THU trơn, không phải "chưa phân loại": phân loại không còn
   *   là một bước, nên gọi nó là thiếu là giục. Nhãn cũ (luồng trước D410) giữ nguyên. Hũ không còn (bị xoá) ⇒ không
   *   bịa tên.
   * ⭐ D421 — founder: *"phân biệt thu/chi vào hũ như nào?"*. Dòng nối hũ có hai hình:
   *   · CHUYỂN (khoản phân bổ, màn HŨ): ô `HŨ` · "Vào XE MÁY" + `→` (nạp) hoặc "Rút XE MÁY" + `←` (rút). Tiền không đi
   *     đâu mất ⇒ không dấu trừ, không dấu cộng, không màu THU — đứng ngoài "đã chi" và ngoài tiền vào.
   *   · GÓP CŨ (CHI nối hũ tích lũy, ghi ở SỔ trước D410): như cũ — ô `HŨ` + tên hũ.
   *   Khoản GÁN chi tiêu (D424) không có dòng — danh sách đã lọc nó (xem `nhom`).
   */
  const chuyen = laPhanBo(k);
  const rut = laRutHu(k);
  const thu = laThu(k);
  const tenHu = hu?.ten ?? null;
  const oChu = thu ? 'THU'
    : chuyen || tenHu !== null ? 'HŨ'
      : k.nhan === null ? CHU_MAN_SO.oChuaNhan : O_CHU_LOAI_CHI[k.nhan];
  const ten = tenKhoanGon(k, tenHu);   // MỘT nơi tính tên khoản — ô CHI HÔM NAY cũng đọc hàm này
  return (
    <>
      <button
        type="button"
        className={`${s.dong} ${thu ? s.thu : ''} ${chuyen ? s.chuyen : ''} ${moi ? s.moi : ''}`}
        aria-expanded={mo}
        onClick={chon}
      >
        <span className={s.o}>{oChu}</span>
        <span className={s.ten}>{ten}</span>
        <span className={s.so}>
          {thu ? '+' : rut ? CP.rutPre : chuyen ? CP.chuyenPre : ''}{dinhDangDong(k.soTien)}<span className={s.dvTien}>đ</span>
        </span>
      </button>
      {mo && (
        /*
         * ⚠⚠ SỬA/XOÁ LÀ MẶC ĐỊNH, HOÀN TÁC CHỈ LÀ LỐI TẮT (lỗi số 8 của §8). Hai nút này
         * gọi thẳng đường ghi của bàn tiền:
         *   · SỬA LẠI ⇒ nhấc số về khay và MỞ bàn phím; cú chạm đích kế tiếp GHI ĐÈ đúng
         *     bản ghi ấy (cùng `id`), không đẻ dòng thứ hai;
         *   · XOÁ ⇒ đặt BIA MỘ, không xoá cứng — cú xoá phải lan sang máy khác qua két.
         * Cả hai đều mở cửa sổ hoàn tác 4 giây như một cú ghi.
         */
        <div className={s.sua}>
          {/* `data-mo-ban-tien` — lối VÀO bàn tiền: chạm nó không tính là "chạm ra ngoài" (bàn không thu xuống, D420). */}
          <button type="button" data-mo-ban-tien="" onClick={sua}>{CHU_MAN_SO.suaLai}</button>
          <button type="button" className={s.xoaD} onClick={xoa}>{CHU_MAN_SO.xoaDong}</button>
        </div>
      )}
    </>
  );
}
